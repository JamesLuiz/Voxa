import logging
from livekit.agents import function_tool, RunContext
import requests
import os
from typing import Optional

logger = logging.getLogger(__name__)

@function_tool()
async def get_business_context(context: RunContext, business_id: str) -> str:
    """Fetch business description, products, policies for AI context."""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {}
        api_key = os.getenv('BACKEND_API_KEY', '')
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            resp = requests.get(f"{backend_url}/api/business/context/{business_id}", headers=headers, timeout=10)
        except Exception as e:
            logger.debug(f"Context fetch by ID failed fast: {e}")
            resp = None

        if not resp or resp.status_code != 200:
            logger.debug(f"Business not found by ID or service error, trying slug: {business_id}")
            try:
                resp_slug = requests.get(f"{backend_url}/api/business/by-slug/{business_id}", headers=headers, timeout=10)
            except Exception as e:
                logger.debug(f"Business slug lookup failed: {e}")
                resp_slug = None

            if resp_slug and resp_slug.status_code == 200:
                business_data = resp_slug.json()
                resolved_id = business_data.get('businessId') or business_data.get('_id')
                if resolved_id:
                    try:
                        resp = requests.get(f"{backend_url}/api/business/context/{resolved_id}", headers=headers, timeout=10)
                    except Exception as e:
                        logger.debug(f"Context fetch by resolved ID failed: {e}")

        if resp and resp.status_code == 200:
            import json as _json
            return _json.dumps(resp.json())

        logger.warning(f"Failed to fetch business context (status): {getattr(resp, 'status_code', 'no-response')}")
        return "{}"
    except Exception as e:
        logger.warning(f"Error fetching business context: {e}")
        return "{}"

@function_tool()
async def get_owner_profile(context: RunContext, identifier: str) -> str:
    """Fetch owner profile by businessId/slug/email; returns JSON string."""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {}
        api_key = os.getenv('BACKEND_API_KEY', '')
        if api_key:
            headers['Authorization'] = f"Bearer {api_key}"

        import json as _json

        try:
            resp_ctx = requests.get(f"{backend_url}/api/business/context/{identifier}", headers=headers, timeout=10)
            if resp_ctx and resp_ctx.status_code == 200:
                data = resp_ctx.json()
                owner = data.get('owner')
                if owner:
                    return _json.dumps(owner)
        except Exception:
            pass

        try:
            resp = requests.get(f"{backend_url}/api/business/{identifier}/owner", headers=headers, timeout=10)
            if resp and resp.status_code == 200:
                return _json.dumps(resp.json())
        except Exception:
            pass

        try:
            resp = requests.get(f"{backend_url}/api/business/by-slug/{identifier}/owner", headers=headers, timeout=10)
            if resp and resp.status_code == 200:
                return _json.dumps(resp.json())
        except Exception:
            pass

        return "{}"
    except Exception as e:
        logger.warning(f"get_owner_profile error: {e}")
        return "{}"

@function_tool()
async def get_analytics(context: RunContext, metric: str, business_id: Optional[str] = None) -> str:
    """Get business metrics: 'overview'|'tickets'|'customers'. business_id may be inferred from room metadata if not provided."""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        
        # Extract business_id from room metadata if not provided
        if not business_id and context:
            try:
                if hasattr(context, 'room') and context.room:
                    room_meta = getattr(context.room, 'metadata', {}) if hasattr(context.room, 'metadata') else {}
                    if isinstance(room_meta, str):
                        import json as _json
                        try:
                            room_meta = _json.loads(room_meta)
                        except:
                            room_meta = {}
                    if isinstance(room_meta, dict) and room_meta.get('businessId'):
                        business_id = room_meta.get('businessId')
            except Exception:
                pass
        
        if not business_id:
            return "Error: Business ID is required to get analytics. Please provide the business context or ensure you're connected with business context."
        
        r = requests.get(f"{backend_url}/api/analytics/{metric}", params={"businessId": business_id}, timeout=10)
        return r.text
    except Exception as e:
        logger.warning(f"get_analytics error: {e}")
        return "{}"


