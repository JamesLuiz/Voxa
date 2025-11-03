import logging
from livekit.agents import function_tool, RunContext
import requests
from langchain_community.tools import DuckDuckGoSearchRun
import os
from typing import Optional

# Configure logger for this module
logger = logging.getLogger(__name__)

@function_tool()
async def get_weather(
    context: RunContext,  # type: ignore
    city: str) -> str:
    """
    Get the current weather for a given city.
    """
    try:
        response = requests.get(
            f"https://wttr.in/{city}?format=3")
        if response.status_code == 200:
            logger.debug(f"Weather for {city}: {response.text.strip()}")
            return response.text.strip()   
        else:
            logger.warning(f"Failed to get weather for {city}: {response.status_code}")
            return f"Could not retrieve weather for {city}."
    except Exception as e:
        logger.warning(f"Error retrieving weather for {city}: {e}")
        return f"An error occurred while retrieving weather for {city}." 

@function_tool()
async def search_web(
    context: RunContext,  # type: ignore
    query: str) -> str:
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

@function_tool()    
async def send_email(
    context: RunContext,  # type: ignore
    to_email: str,
    subject: str,
    message: str,
    business_id: str,
    cc_email: Optional[str] = None
) -> str:
    """
    Send an email using SendGrid. Prefer the business-stored SendGrid API key (via /full),
    otherwise fall back to the server-wide SEND_GRID environment variable.
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")

        # Try to fetch business metadata first
        response = requests.get(
            f"{backend_url}/api/email-credentials/{business_id}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )

        if response.status_code != 200:
            logger.warning(f"Failed to fetch email credentials for business {business_id}")
            return "Email sending failed: Could not retrieve email credentials."

        credentials = response.json()
        from_email = credentials.get('email') or os.getenv('DEFAULT_FROM_EMAIL')

        # Attempt to get decrypted business API key via the protected endpoint
        api_key = None
        try:
            full_resp = requests.get(
                f"{backend_url}/api/email-credentials/{business_id}/full",
                headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
                timeout=10
            )
            if full_resp.status_code == 200:
                full_json = full_resp.json()
                # service stores sendgridApiKey as encrypted key previously; backend returns it as sendgridApiKey or apiKey
                api_key = full_json.get('sendgridApiKey') or full_json.get('apiKey') or full_json.get('password')
        except Exception:
            api_key = None

        # Fallback to server-wide SEND_GRID
        if not api_key:
            api_key = os.getenv('SEND_GRID')

        if not api_key:
            logger.warning('No SendGrid API key available for sending')
            return 'Email sending failed: No SendGrid API key available.'

        if not from_email:
            logger.warning('No from email configured')
            return 'Email sending failed: No from email configured.'

        # Build SendGrid payload
        payload = {
            "personalizations": [
                {
                    "to": [{ "email": to_email }],
                    "subject": subject,
                }
            ],
            "from": { "email": from_email },
            "content": [{ "type": "text/plain", "value": message }]
        }
        if cc_email:
            payload["personalizations"][0]["cc"] = [{ "email": cc_email }]

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        send_resp = requests.post("https://api.sendgrid.com/v3/mail/send", json=payload, headers=headers, timeout=10)
        if send_resp.status_code in (200, 202):
            logger.debug(f"Email sent successfully to {to_email}")
            return f"Email sent successfully to {to_email}"
        else:
            logger.warning(f"SendGrid send failed: {send_resp.status_code} {send_resp.text}")
            return f"Email sending failed: SendGrid error {send_resp.status_code} - {send_resp.text}"

    except Exception as e:
        logger.warning(f"Error sending email via SendGrid: {e}")
        return f"An error occurred while sending email: {str(e)}"

@function_tool()
async def crm_lookup(
    context: RunContext,  # type: ignore
    email: str
) -> str:
    """
    Look up customer information in the CRM system.
    
    Args:
        email: Customer email address
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        response = requests.get(
            f"{backend_url}/api/crm/customers/email/{email}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if response.status_code == 200:
            customer = response.json()
            logger.debug(f"Found customer: {customer.get('name', 'Unknown')}")
            
            # Format customer information
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
    email: str
) -> str:
    """
    Get customer history including orders and tickets.
    
    Args:
        email: Customer email address
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        
        # Get customer first
        customer_response = requests.get(
            f"{backend_url}/api/crm/customers/email/{email}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if customer_response.status_code != 200:
            return f"Customer not found for email: {email}"
        
        customer = customer_response.json()
        customer_id = customer.get('_id')
        
        history = f"Customer: {customer.get('name', 'Unknown')}\n\n"
        
        # Get orders
        orders_response = requests.get(
            f"{backend_url}/api/crm/orders/customer/{customer_id}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
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
async def create_ticket(
    context: RunContext,
    title: str,
    description: str,
    priority: str = "medium",
    customer_email: Optional[str] = None,
    business_id: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None
) -> str:
    """
    Create a support ticket with best-effort customer look-up or upsert first.
    If business_id is not provided, attempt to extract from context/room metadata.
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"}
        
        # Try to get business_id from context if not provided
        if not business_id and context:
            try:
                # Attempt to get from room metadata via context
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
        
        # Try to get customer email from context if not provided
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
        
        # Create or update customer record using email
        customer_data = {
            'businessId': business_id,
            'email': customer_email
        }
        
        if customer_name:
            customer_data['name'] = customer_name
        if customer_phone:
            customer_data['phone'] = customer_phone
            
        # Upsert customer to ensure we have a record
        customer_resp = requests.post(
            f"{backend_url}/api/crm/customers/upsert", 
            json=customer_data, 
            headers=headers, 
            timeout=10
        )
        
        if not customer_resp.ok:
            logger.warning(f"Failed to upsert customer: {customer_resp.status_code} {customer_resp.text}")
            return "Failed to create ticket: Could not process customer information."
        
        # Create ticket with customer email directly
        ticket_data = {
            "title": title,
            "description": description,
            "priority": priority,
            "status": "open",
            "businessId": business_id,
            "customerEmail": customer_email  # Use email instead of ID
        }
        
        response = requests.post(
            f"{backend_url}/api/tickets",
            json=ticket_data,
            headers=headers,
            timeout=10
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
async def schedule_meeting(
    context: RunContext,  # type: ignore
    title: str,
    start_time: str,
    duration_minutes: int = 30,
    attendees: Optional[str] = None
) -> str:
    """
    Schedule a meeting or appointment.
    
    Args:
        title: Meeting title
        start_time: Meeting start time (ISO format)
        duration_minutes: Meeting duration in minutes
        attendees: Comma-separated list of attendee emails
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        
        meeting_data = {
            "title": title,
            "startTime": start_time,
            "duration": duration_minutes,
            "attendees": attendees.split(",") if attendees else [],
            "status": "confirmed"
        }
        
        response = requests.post(
            f"{backend_url}/api/meetings",
            json=meeting_data,
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if response.status_code == 200 or response.status_code == 201:
            meeting = response.json()
            logger.debug(f"Created meeting: {meeting.get('_id')}")
            return f"Meeting scheduled successfully: {title} at {start_time}"
        else:
            logger.warning(f"Failed to create meeting: {response.status_code}")
            return "Failed to schedule meeting"
            
    except Exception as e:
        logger.warning(f"Error scheduling meeting: {e}")
        return f"An error occurred while scheduling meeting: {str(e)}"

# -------------------- NEW TOOLS (Phase 2) --------------------

@function_tool()
async def get_business_context(context: RunContext, business_id: str) -> str:
    """Fetch business description, products, policies for AI context"""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {}
        api_key = os.getenv('BACKEND_API_KEY', '')
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        # First try to get by ID/context endpoint
        try:
            resp = requests.get(f"{backend_url}/api/business/context/{business_id}", headers=headers, timeout=10)
        except Exception as e:
            logger.debug(f"Context fetch by ID failed fast: {e}")
            resp = None

        # If not found or not OK, try by slug endpoint
        if not resp or resp.status_code != 200:
            logger.debug(f"Business not found by ID or service error, trying slug: {business_id}")
            try:
                resp_slug = requests.get(f"{backend_url}/api/business/by-slug/{business_id}", headers=headers, timeout=10)
            except Exception as e:
                logger.debug(f"Business slug lookup failed: {e}")
                resp_slug = None

            if resp_slug and resp_slug.status_code == 200:
                business_data = resp_slug.json()
                # Endpoint returns { businessId, name, slug }
                resolved_id = business_data.get('businessId') or business_data.get('_id')
                if resolved_id:
                    try:
                        resp = requests.get(f"{backend_url}/api/business/context/{resolved_id}", headers=headers, timeout=10)
                    except Exception as e:
                        logger.debug(f"Context fetch by resolved ID failed: {e}")

        if resp and resp.status_code == 200:
            # Return as JSON string for parsing
            import json as _json
            return _json.dumps(resp.json())

        # Return empty dict string when not found (caller expects JSON string)
        logger.warning(f"Failed to fetch business context (status): {getattr(resp, 'status_code', 'no-response')}")
        return "{}"
    except Exception as e:
        logger.warning(f"Error fetching business context: {e}")
        return "{}"


@function_tool()
async def get_owner_profile(context: RunContext, identifier: str) -> str:
    """Fetch owner profile. `identifier` may be a businessId, business slug, or owner email.
    Prefers business context (exposes owner), then owner endpoints by id/slug. Returns JSON string.
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {}
        api_key = os.getenv('BACKEND_API_KEY', '')
        if api_key:
            headers['Authorization'] = f"Bearer {api_key}"

        import json as _json

        # Try business context first (by id). It now includes owner info.
        try:
            resp_ctx = requests.get(f"{backend_url}/api/business/context/{identifier}", headers=headers, timeout=10)
            if resp_ctx and resp_ctx.status_code == 200:
                data = resp_ctx.json()
                owner = data.get('owner')
                if owner:
                    return _json.dumps(owner)
        except Exception:
            pass

        # Try business owner endpoint by id
        try:
            resp = requests.get(f"{backend_url}/api/business/{identifier}/owner", headers=headers, timeout=10)
            if resp and resp.status_code == 200:
                return _json.dumps(resp.json())
        except Exception:
            pass

        # Try slug-based owner lookup
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

@function_tool()
async def manage_customer(context: RunContext, action: str, data: dict) -> str:
    """CRM: 'upsert', 'create', 'update', 'delete', 'search' customers, always returns full customer object as JSON.
    If businessId is missing in data, attempt to extract from context."""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {}
        api_key = os.getenv('BACKEND_API_KEY', '')
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        # Try to get businessId from context if not in data
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
async def get_analytics(context: RunContext, metric: str, business_id: str) -> str:
    """Get business metrics: 'overview'|'tickets'|'customers'"""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        r = requests.get(f"{backend_url}/api/analytics/{metric}", params={"businessId": business_id}, timeout=10)
        return r.text
    except Exception as e:
        logger.warning(f"get_analytics error: {e}")
        return "{}"

# Helper for email validation
import re
def is_valid_email(email:str) -> bool:
    return bool(re.match(r"^\S+@\S+\.\S+$", email))

def is_valid_phone(phone:str) -> bool:
    # Very simple: at least 10 digits
    import re
    return bool(re.sub(r"\D", "", phone)) and len(re.sub(r"\D", "", phone))>=10