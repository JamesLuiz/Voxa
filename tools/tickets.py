import logging
from livekit.agents import function_tool, RunContext
import requests
import os
from typing import Optional

logger = logging.getLogger(__name__)

@function_tool()
async def create_ticket(
    context: RunContext,
    title: str,
    description: str,
    priority: str = "medium",
    customer_email: Optional[str] = None,
    business_id: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
) -> str:
    """
    Create a support ticket with best-effort customer upsert. business_id may be inferred from room metadata.
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"}

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
            return "Error: Business ID is required to create a ticket. Please provide the business context."

        if not customer_email and context:
            try:
                if hasattr(context, 'room') and context.room:
                    room_meta = getattr(context.room, 'metadata', {}) if hasattr(context.room, 'metadata') else {}
                    if isinstance(room_meta, str):
                        import json as _json
                        try:
                            room_meta = _json.loads(room_meta)
                        except:
                            room_meta = {}
                    if isinstance(room_meta, dict) and room_meta.get('email'):
                        customer_email = room_meta.get('email')
            except Exception:
                pass

        if not customer_email:
            return "Error: Customer email is required to create a ticket."

        customer_data = {
            'businessId': business_id,
            'email': customer_email,
        }
        if customer_name:
            customer_data['name'] = customer_name
        if customer_phone:
            customer_data['phone'] = customer_phone

        customer_resp = requests.post(
            f"{backend_url}/api/crm/customers/upsert",
            json=customer_data,
            headers=headers,
            timeout=10,
        )
        if not customer_resp.ok:
            logger.warning(f"Failed to upsert customer: {customer_resp.status_code} {customer_resp.text}")
            return "Failed to create ticket: Could not process customer information."

        ticket_data = {
            "title": title,
            "description": description,
            "priority": priority,
            "status": "open",
            "businessId": business_id,
            "userEmail": customer_email,
        }
        response = requests.post(
            f"{backend_url}/api/tickets",
            json=ticket_data,
            headers=headers,
            timeout=10,
        )
        if response.status_code in (200, 201):
            ticket = response.json()
            logger.debug(f"Created ticket: {ticket.get('_id')}")
            return f"Support ticket created successfully. Ticket ID: {ticket.get('_id', 'N/A')}"
        else:
            logger.warning(f"Failed to create ticket: {response.status_code} {response.text}")
            return f"Failed to create support ticket: {response.text}"
    except Exception as e:
        logger.warning(f"Error creating ticket: {e}")
        return f"An error occurred while creating ticket: {str(e)}"

@function_tool()
async def update_ticket(context: RunContext, ticket_id: str, status: str, notes: str = "") -> str:
    """Update ticket status (owner only)"""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        out = {}
        r = requests.put(f"{backend_url}/api/tickets/{ticket_id}/status", json={"status": status}, timeout=10)
        out['status'] = r.json()
        if notes:
            r2 = requests.post(f"{backend_url}/api/tickets/{ticket_id}/notes", json={"note": notes}, timeout=10)
            out['note'] = r2.json()
        return str(out)
    except Exception as e:
        logger.warning(f"update_ticket error: {e}")
        return "{}"

@function_tool()
async def list_tickets(context: RunContext, business_id: str, status: Optional[str] = None) -> str:
    """List tickets for a business. Optional status filter: open|in-progress|resolved|closed"""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        params = {"businessId": business_id}
        if status:
            params["status"] = status
        r = requests.get(f"{backend_url}/api/tickets", params=params, timeout=10)
        return r.text
    except Exception as e:
        logger.warning(f"list_tickets error: {e}")
        return "[]"


