import logging
import asyncio
import json
import hashlib
from datetime import datetime
from typing import Optional, List, Dict, Any
from livekit.agents import function_tool, RunContext
from duckduckgo_search import DDGS
import requests
from bs4 import BeautifulSoup
import re

logger = logging.getLogger(__name__)

# Simple in-memory cache (can be upgraded to Redis later)
_search_cache: Dict[str, Dict[str, Any]] = {}
_cache_ttl = 3600  # 1 hour cache TTL


def _get_cache_key(query: str, max_results: int = 10) -> str:
    """Generate cache key from query and parameters."""
    key_str = f"{query.lower().strip()}:{max_results}"
    return hashlib.md5(key_str.encode()).hexdigest()


def _is_cache_valid(cache_entry: Dict[str, Any]) -> bool:
    """Check if cache entry is still valid."""
    if not cache_entry:
        return False
    cached_time = cache_entry.get('timestamp', 0)
    age = datetime.now().timestamp() - cached_time
    return age < _cache_ttl


def _extract_content_from_url(url: str, timeout: int = 5) -> Optional[str]:
    """Extract main content from a webpage."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()
        
        # Try to find main content
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile(r'content|main|article', re.I))
        
        if main_content:
            text = main_content.get_text(separator=' ', strip=True)
        else:
            text = soup.get_text(separator=' ', strip=True)
        
        # Clean up text
        text = re.sub(r'\s+', ' ', text)
        text = text[:2000]  # Limit to 2000 characters
        
        return text if text else None
    except Exception as e:
        logger.debug(f"Failed to extract content from {url}: {e}")
        return None


def _validate_result(result: Dict[str, Any], query: str) -> bool:
    """Validate if a search result is relevant."""
    if not result:
        return False
    
    title = result.get('title', '').lower()
    body = result.get('body', '').lower()
    query_lower = query.lower()
    
    # Check if query terms appear in title or body
    query_terms = query_lower.split()
    title_matches = sum(1 for term in query_terms if term in title)
    body_matches = sum(1 for term in query_terms if term in body)
    
    # Result is relevant if at least 30% of query terms match
    relevance_score = (title_matches * 2 + body_matches) / (len(query_terms) * 3)
    return relevance_score >= 0.3


def _refine_query(query: str) -> str:
    """Refine search query for better results."""
    # Remove common stop words that don't help search
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
    words = query.split()
    refined = [w for w in words if w.lower() not in stop_words or len(words) <= 3]
    
    # If query is too short, return as is
    if len(refined) < 2:
        return query
    
    return ' '.join(refined)


def _summarize_results(results: List[Dict[str, Any]], query: str) -> str:
    """Create a summary of search results."""
    if not results:
        return "No relevant results found."
    
    summary_parts = [f"Found {len(results)} relevant results for '{query}':\n"]
    
    for i, result in enumerate(results[:5], 1):  # Summarize top 5
        title = result.get('title', 'No title')
        url = result.get('url', 'No URL')
        snippet = result.get('snippet', '')[:200]  # First 200 chars
        
        summary_parts.append(f"{i}. {title}")
        summary_parts.append(f"   URL: {url}")
        if snippet:
            summary_parts.append(f"   Summary: {snippet}...")
        summary_parts.append("")
    
    return "\n".join(summary_parts)


@function_tool()
async def search_web(
    context: RunContext,  # type: ignore
    query: str,
    max_results: int = 10,
    extract_content: bool = True,
    region: Optional[str] = None,
    safe_search: bool = True,
) -> str:
    """
    Search the web using DuckDuckGo with enhanced features. 
    
    IMPORTANT: When you use this tool, you MUST read and use the search results in your response. 
    Don't just search and ignore the results - extract key information and incorporate it naturally.
    
    Args:
        query: The search query string (be specific for better results)
        max_results: Maximum number of results to return (default: 10, max: 20)
        extract_content: Whether to extract full content from top results (default: True) - recommended for detailed answers
        region: Region code for localized results (e.g., 'us-en', 'uk-en', 'de-de')
        safe_search: Enable safe search filtering (default: True)
    
    Returns:
        JSON string with structured search results including:
        - titles: Article/page titles
        - urls: Source URLs
        - snippets: Brief summaries from search results
        - extracted_content: Full content from top 3 results (if extract_content=True)
        - summary: A formatted summary of all results
        
    Usage: After calling this tool, parse the JSON response and use the information found to answer the user's question.
    Cite sources when relevant: "According to [title from results]..." or "I found that [information from results]..."
    """
    try:
        # Validate and refine query
        if not query or not query.strip():
            return json.dumps({"error": "Query cannot be empty", "results": []})
        
        query = query.strip()
        refined_query = _refine_query(query)
        max_results = min(max(1, max_results), 20)  # Clamp between 1 and 20
        
        # Check cache
        cache_key = _get_cache_key(refined_query, max_results)
        if cache_key in _search_cache:
            cached = _search_cache[cache_key]
            if _is_cache_valid(cached):
                logger.debug(f"Returning cached results for '{query}'")
                return cached['data']
            else:
                # Remove expired cache
                del _search_cache[cache_key]
        
        # Run search in executor to avoid blocking
        loop = asyncio.get_event_loop()
        
        def _run_search():
            """Run DuckDuckGo search synchronously."""
            try:
                with DDGS() as ddgs:
                    # Configure search parameters
                    search_params = {
                        'keywords': refined_query,
                        'max_results': max_results,
                    }
                    
                    if region:
                        search_params['region'] = region
                    
                    if safe_search:
                        search_params['safesearch'] = 'moderate'
                    
                    # Perform search
                    results = list(ddgs.text(**search_params))
                    return results
            except Exception as e:
                logger.warning(f"DuckDuckGo search error: {e}")
                raise
        
        # Execute search with timeout
        try:
            raw_results = await asyncio.wait_for(
                loop.run_in_executor(None, _run_search),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            logger.warning(f"Search timeout for query: '{query}'")
            return json.dumps({
                "error": "Search request timed out. Please try again.",
                "query": query,
                "results": []
            })
        except Exception as e:
            logger.warning(f"Search error for '{query}': {e}")
            return json.dumps({
                "error": f"Search failed: {str(e)}",
                "query": query,
                "results": []
            })
        
        if not raw_results:
            # Even if no results, return a structured response that the agent can work with
            # Don't say "no results" - let the agent try to help anyway
            logger.debug(f"No raw results for query: '{query}', but continuing with empty results")
            raw_results = []
        
        # Process and validate results
        processed_results = []
        for result in raw_results[:max_results]:
            if not isinstance(result, dict):
                continue
            
            # Less strict validation - include results even if relevance is lower
            # This ensures we have something to work with
            relevance_score = 0.0
            if _validate_result(result, query):
                relevance_score = 1.0
            else:
                # Still include if it has some basic info
                title = result.get('title', '').lower()
                body = result.get('body', '').lower()
                query_lower = query.lower()
                if any(term in title or term in body for term in query_lower.split()[:3]):
                    relevance_score = 0.5  # Lower relevance but still useful
            
            processed_result = {
                "title": result.get('title', 'No title'),
                "url": result.get('href', ''),
                "snippet": result.get('body', ''),
                "date": result.get('date', ''),
                "relevance": relevance_score,
            }
            
            # Extract full content if requested (for top 3 results only)
            if extract_content and len(processed_results) < 3 and processed_result['url']:
                try:
                    content = await asyncio.get_event_loop().run_in_executor(
                        None,
                        _extract_content_from_url,
                        processed_result['url']
                    )
                    if content:
                        processed_result['extracted_content'] = content[:1500]  # Limit extracted content
                except Exception as e:
                    logger.debug(f"Failed to extract content from {processed_result['url']}: {e}")
                    # Continue without extracted content
            
            processed_results.append(processed_result)
        
        # Sort by relevance if we have relevance scores
        if processed_results and any(r.get('relevance') for r in processed_results):
            processed_results.sort(key=lambda x: x.get('relevance', 0), reverse=True)
        
        # Create structured response - always provide something useful
        if processed_results:
            summary = _summarize_results(processed_results, query)
            message = f"Found {len(processed_results)} result(s) for your query. Use the information below to answer the user's question."
        else:
            # Even with no results, provide guidance
            summary = f"Limited results for '{query}'. Use your knowledge to provide a helpful response based on general information about the topic."
            message = "No specific search results found, but you can still provide helpful information based on your knowledge."
        
        response_data = {
            "query": query,
            "refined_query": refined_query,
            "total_results": len(processed_results),
            "results": processed_results,
            "summary": summary,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "note": "ALWAYS use the information in 'results' and 'summary' fields to answer the user's question. Even if results are limited, extract and use whatever information is available."
        }
        
        # Cache the results
        _search_cache[cache_key] = {
            'data': json.dumps(response_data, indent=2),
            'timestamp': datetime.now().timestamp()
        }
        
        # Limit cache size (keep last 100 entries)
        if len(_search_cache) > 100:
            oldest_key = min(_search_cache.keys(), key=lambda k: _search_cache[k]['timestamp'])
            del _search_cache[oldest_key]
        
        logger.debug(f"Search completed for '{query}': {len(processed_results)} results")
        
        return json.dumps(response_data, indent=2)
        
    except Exception as e:
        logger.error(f"Unexpected error in search_web: {e}", exc_info=True)
        return json.dumps({
            "error": f"An unexpected error occurred: {str(e)}",
            "query": query if 'query' in locals() else "unknown",
            "results": []
        })


