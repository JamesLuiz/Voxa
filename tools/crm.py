import logging
from livekit.agents import function_tool, RunContext
import requests
import os
from typing import Optional

logger = logging.getLogger(__name__)

@function_tool()
async def crm_lookup(
    context: RunContext,  # type: ignore
    email: str,
) -> str:
    """
    Look up customer information in the CRM system.
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        response = requests.get(
            f"{backend_url}/api/crm/customers/email/{email}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10,
        )

        if response.status_code == 200:
            customer = response.json()
            logger.debug(f"Found customer: {customer.get('name', 'Unknown')}")

            info = f"Customer: {customer.get('name', 'Unknown')}\n"
            info += f"Email: {customer.get('email', 'N/A')}\n"
            info += f"Phone: {customer.get('phone', 'N/A')}\n"
            info += f"Company: {customer.get('company', 'N/A')}\n"
            return info
        else:
            logger.warning(f"Customer not found for email: {email}")
            return f"Customer not found for email: {email}"

    except Exception as e:
        logger.warning(f"Error looking up customer: {e}")
        return f"An error occurred while looking up customer: {str(e)}"

@function_tool()
async def get_customer_history(
    context: RunContext,  # type: ignore
    email: str,
) -> str:
    """
    Get customer history including orders and tickets.
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")

        customer_response = requests.get(
            f"{backend_url}/api/crm/customers/email/{email}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10,
        )

        if customer_response.status_code != 200:
            return f"Customer not found for email: {email}"

        customer = customer_response.json()
        customer_id = customer.get('_id')

        history = f"Customer: {customer.get('name', 'Unknown')}\n\n"

        orders_response = requests.get(
            f"{backend_url}/api/crm/orders/customer/{customer_id}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10,
        )

        if orders_response.status_code == 200:
            orders = orders_response.json()
            history += f"Recent Orders ({len(orders)}):\n"
            for order in orders[:5]:
                history += f"- {order.get('items', 'N/A')}: ${order.get('amount', 0)}\n"

        return history

    except Exception as e:
        logger.warning(f"Error getting customer history: {e}")
        return f"An error occurred while fetching customer history: {str(e)}"

@function_tool()
async def manage_customer(context: RunContext, action: str, data: dict) -> str:
    """CRM: 'upsert', 'create', 'update', 'delete', 'search' customers, returns JSON."""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {}
        api_key = os.getenv('BACKEND_API_KEY', '')
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        if not data.get('businessId') and context:
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
                        data['businessId'] = room_meta.get('businessId')
            except Exception:
                pass

        if action == 'upsert':
            r = requests.post(f"{backend_url}/api/crm/customers/upsert", json=data, headers=headers, timeout=10)
            return r.text
        if action == 'create':
            r = requests.post(f"{backend_url}/api/crm/customers", json=data, headers=headers, timeout=10)
            return r.text
        if action == 'update':
            r = requests.put(f"{backend_url}/api/crm/customers/{data.get('id')}", json=data, headers=headers, timeout=10)
            return r.text
        if action == 'delete':
            r = requests.delete(f"{backend_url}/api/crm/customers/{data.get('id')}", headers=headers, timeout=10)
            return r.text
        if action == 'search':
            q = data.get('q', '')
            business_id = data.get('businessId', '')
            r = requests.get(f"{backend_url}/api/crm/customers/search", params={"q": q, "businessId": business_id}, headers=headers, timeout=10)
            return r.text
        return "{}"
    except Exception as e:
        logger.warning(f"manage_customer error: {e}")
        return "{}"


