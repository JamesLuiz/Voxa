import logging
from livekit.agents import function_tool, RunContext
import requests
from langchain_community.tools import DuckDuckGoSearchRun
import os
import smtplib
from email.mime.multipart import MIMEMultipart  
from email.mime.text import MIMEText
from typing import Optional

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
            logging.info(f"Weather for {city}: {response.text.strip()}")
            return response.text.strip()   
        else:
            logging.error(f"Failed to get weather for {city}: {response.status_code}")
            return f"Could not retrieve weather for {city}."
    except Exception as e:
        logging.error(f"Error retrieving weather for {city}: {e}")
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
        logging.info(f"Search results for '{query}': {results}")
        return results
    except Exception as e:
        logging.error(f"Error searching the web for '{query}': {e}")
        return f"An error occurred while searching the web for '{query}'."    

@function_tool()    
async def send_email(
    context: RunContext,  # type: ignore
    to_email: str,
    subject: str,
    message: str,
    cc_email: Optional[str] = None
) -> str:
    """
    Send an email through Gmail.
    
    Args:
        to_email: Recipient email address
        subject: Email subject line
        message: Email body content
        cc_email: Optional CC email address
    """
    try:
        # Gmail SMTP configuration
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        
        # Get credentials from environment variables
        gmail_user = os.getenv("GMAIL_USER")
        gmail_password = os.getenv("GMAIL_APP_PASSWORD")  # Use App Password, not regular password
        
        if not gmail_user or not gmail_password:
            logging.error("Gmail credentials not found in environment variables")
            return "Email sending failed: Gmail credentials not configured."
        
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
        
        # Connect to Gmail SMTP server
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()  # Enable TLS encryption
        server.login(gmail_user, gmail_password)
        
        # Send email
        text = msg.as_string()
        server.sendmail(gmail_user, recipients, text)
        server.quit()
        
        logging.info(f"Email sent successfully to {to_email}")
        return f"Email sent successfully to {to_email}"
        
    except smtplib.SMTPAuthenticationError:
        logging.error("Gmail authentication failed")
        return "Email sending failed: Authentication error. Please check your Gmail credentials."
    except smtplib.SMTPException as e:
        logging.error(f"SMTP error occurred: {e}")
        return f"Email sending failed: SMTP error - {str(e)}"
    except Exception as e:
        logging.error(f"Error sending email: {e}")
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
        backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
        response = requests.get(
            f"{backend_url}/api/crm/customers/email/{email}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if response.status_code == 200:
            customer = response.json()
            logging.info(f"Found customer: {customer.get('name', 'Unknown')}")
            
            # Format customer information
            info = f"Customer: {customer.get('name', 'Unknown')}\n"
            info += f"Email: {customer.get('email', 'N/A')}\n"
            info += f"Phone: {customer.get('phone', 'N/A')}\n"
            info += f"Company: {customer.get('company', 'N/A')}\n"
            
            return info
        else:
            logging.warning(f"Customer not found for email: {email}")
            return f"Customer not found for email: {email}"
            
    except Exception as e:
        logging.error(f"Error looking up customer: {e}")
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
        backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
        
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
        logging.error(f"Error getting customer history: {e}")
        return f"An error occurred while fetching customer history: {str(e)}"

@function_tool()
async def create_ticket(
    context: RunContext,  # type: ignore
    title: str,
    description: str,
    priority: str = "medium",
    customer_email: Optional[str] = None
) -> str:
    """
    Create a support ticket in the CRM system.
    
    Args:
        title: Ticket title
        description: Ticket description
        priority: Priority level (low, medium, high, urgent)
        customer_email: Customer email (optional)
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
        
        ticket_data = {
            "title": title,
            "description": description,
            "priority": priority,
            "status": "open"
        }
        
        response = requests.post(
            f"{backend_url}/api/crm/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if response.status_code == 200 or response.status_code == 201:
            ticket = response.json()
            logging.info(f"Created ticket: {ticket.get('_id')}")
            return f"Support ticket created successfully. Ticket ID: {ticket.get('_id', 'N/A')}"
        else:
            logging.error(f"Failed to create ticket: {response.status_code}")
            return "Failed to create support ticket"
            
    except Exception as e:
        logging.error(f"Error creating ticket: {e}")
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
        backend_url = os.getenv("BACKEND_URL", "http://localhost:3000")
        
        meeting_data = {
            "title": title,
            "startTime": start_time,
            "duration": duration_minutes,
            "attendees": attendees.split(",") if attendees else [],
            "status": "confirmed"
        }
        
        response = requests.post(
            f"{backend_url}/api/scheduling/meetings",
            json=meeting_data,
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10
        )
        
        if response.status_code == 200 or response.status_code == 201:
            meeting = response.json()
            logging.info(f"Created meeting: {meeting.get('_id')}")
            return f"Meeting scheduled successfully: {title} at {start_time}"
        else:
            logging.error(f"Failed to create meeting: {response.status_code}")
            return "Failed to schedule meeting"
            
    except Exception as e:
        logging.error(f"Error scheduling meeting: {e}")
        return f"An error occurred while scheduling meeting: {str(e)}"