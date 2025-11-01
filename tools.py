import logging
from livekit.agents import function_tool, RunContext
import requests
from langchain_community.tools import DuckDuckGoSearchRun
import os
import smtplib
from email.mime.multipart import MIMEMultipart  
from email.mime.text import MIMEText
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
    Send an email using the business's stored email credentials.
    
    Args:
        to_email: Recipient email address
        subject: Email subject line
        message: Email body content
        business_id: ID of the business whose credentials to use
        cc_email: Optional CC email address
    """
    try:
        # Get backend URL from environment or use default
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        
        # Fetch email credentials from the backend
        response = requests.get(
            f"{backend_url}/api/email-credentials/{business_id}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if response.status_code != 200:
            logger.warning(f"Failed to fetch email credentials for business {business_id}")
            return "Email sending failed: Could not retrieve email credentials."
        
        credentials = response.json()
        
        # SMTP configuration
        smtp_server = credentials.get('smtpServer', 'smtp.gmail.com')
        smtp_port = credentials.get('smtpPort', 587)
        gmail_user = credentials.get('email')
        
    # Request the full credentials (this endpoint returns the decrypted password when the request
    # is authorized with the BACKEND_API_KEY).
        password_response = requests.get(
            f"{backend_url}/api/email-credentials/{business_id}/full",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if password_response.status_code != 200:
            logger.warning(f"Failed to fetch email password for business {business_id}")
            return "Email sending failed: Could not retrieve email password."
        
        full_credentials = password_response.json()
        gmail_password = full_credentials.get('password')
        
        if not gmail_user or not gmail_password:
            logger.warning("Email credentials incomplete")
            return "Email sending failed: Email credentials not properly configured."
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Add CC if provided
        recipients = [to_email]
        if cc_email:
            msg['Cc'] = cc_email
            recipients.append(cc_email)
        
        # Attach message body
        msg.attach(MIMEText(message, 'plain'))
        
        # Connect to SMTP server
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()  # Enable TLS encryption
        server.login(gmail_user, gmail_password)
        
        # Send email
        text = msg.as_string()
        server.sendmail(gmail_user, recipients, text)
        server.quit()
        
        logger.debug(f"Email sent successfully to {to_email}")
        return f"Email sent successfully to {to_email}"
        
    except smtplib.SMTPAuthenticationError:
        logger.warning("Email authentication failed")
        return "Email sending failed: Authentication error. Please check your email credentials."
    except smtplib.SMTPException as e:
        logger.warning(f"SMTP error occurred: {e}")
        return f"Email sending failed: SMTP error - {str(e)}"
    except Exception as e:
        logger.warning(f"Error sending email: {e}")
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
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        customer_id = None
        # Try to look up by email + business
        if customer_email and business_id:
            lookup_payload = { 'businessId': business_id, 'email': customer_email }
            look_resp = requests.post(f"{backend_url}/api/crm/customers/upsert", json={ 'businessId': business_id, 'email': customer_email, 'name': customer_name or '' }, timeout=10)
            if look_resp.ok:
                customer = look_resp.json()
                customer_id = customer.get('_id')
        ticket_data = {
            "title": title,
            "description": description,
            "priority": priority,
            "status": "open",
            "businessId": business_id,
            "customerId": customer_id,
        }
        response = requests.post(
            f"{backend_url}/api/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        if response.status_code in (200, 201):
            ticket = response.json()
            logger.debug(f"Created ticket: {ticket.get('_id')}")
            return f"Support ticket created successfully. Ticket ID: {ticket.get('_id', 'N/A')}"
        else:
            logger.warning(f"Failed to create ticket: {response.status_code}")
            return "Failed to create support ticket"
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
        resp = requests.get(f"{backend_url}/api/business/context/{business_id}", timeout=10)
        if resp.status_code == 200:
            return resp.text
        return "{}"
    except Exception as e:
        logger.warning(f"Error fetching business context: {e}")
        return "{}"

@function_tool()
async def manage_customer(context: RunContext, action: str, data: dict) -> str:
    """CRM: 'upsert', 'create', 'update', 'delete', 'search' customers, always returns full customer object as JSON"""
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        if action == 'upsert':
            r = requests.post(f"{backend_url}/api/crm/customers/upsert", json=data, timeout=10)
            return r.text
        if action == 'create':
            r = requests.post(f"{backend_url}/api/crm/customers", json=data, timeout=10)
            return r.text
        if action == 'update':
            r = requests.put(f"{backend_url}/api/crm/customers/{data.get('id')}", json=data, timeout=10)
            return r.text
        if action == 'delete':
            import requests as rq
            r = rq.delete(f"{backend_url}/api/crm/customers/{data.get('id')}", timeout=10)
            return r.text
        if action == 'search':
            q = data.get('q', '')
            business_id = data.get('businessId', '')
            r = requests.get(f"{backend_url}/api/crm/customers/search", params={"q": q, "businessId": business_id}, timeout=10)
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