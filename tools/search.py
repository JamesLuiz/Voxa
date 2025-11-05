import logging
from livekit.agents import function_tool, RunContext
from langchain_community.tools import DuckDuckGoSearchRun

logger = logging.getLogger(__name__)

@function_tool()
async def search_web(
    context: RunContext,  # type: ignore
    query: str,
) -> str:
    """
    Search the web using DuckDuckGo.
    """
    try:
        results = DuckDuckGoSearchRun().run(tool_input=query)
        logger.debug(f"Search results for '{query}': {results}")
        return results
    except Exception as e:
        logger.warning(f"Error searching the web for '{query}': {e}")
        return f"An error occurred while searching the web for '{query}'."


