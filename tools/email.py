import logging
from livekit.agents import function_tool, RunContext
import requests
import os
from typing import Optional

logger = logging.getLogger(__name__)

@function_tool(
    description="Send an email to any recipient using SendGrid. Use this tool when the user asks you to send an email, email someone, or send a message via email. The tool automatically uses the business's SendGrid credentials. Required parameters: to_email (recipient's email address), subject (email subject line), and message (email body content). Optional: business_id (will be auto-detected from context), cc_email (to CC someone). Example: 'Send an email to john@example.com with subject 'Welcome' and message 'Thank you for joining!'"
)
async def send_email(
    context: RunContext,  # type: ignore
    to_email: str,
    subject: str,
    message: str,
    business_id: Optional[str] = None,
    cc_email: Optional[str] = None,
) -> str:
    """
    Send an email using SendGrid. Prefer the business-stored SendGrid API key (via /full),
    otherwise fall back to the server-wide SEND_GRID environment variable.
    business_id may be inferred from room metadata if not provided.
    
    Args:
        to_email: The recipient's email address (required)
        subject: The email subject line (required)
        message: The email message body (required)
        business_id: The business ID (optional, will be extracted from room context if not provided)
        cc_email: Optional CC email address
    
    Returns:
        Success message if email sent, or error message if failed
    """
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
            return "Error: Business ID is required to send email. Please provide the business context or ensure you're connected with business context."

        # Try to fetch business metadata first
        response = requests.get(
            f"{backend_url}/api/email-credentials/{business_id}",
            headers={"Authorization": f"Bearer {os.getenv('BACKEND_API_KEY', '')}"},
            timeout=10,
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
                timeout=10,
            )
            if full_resp.status_code == 200:
                full_json = full_resp.json()
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
                    "to": [{"email": to_email}],
                    "subject": subject,
                }
            ],
            "from": {"email": from_email},
            "content": [{"type": "text/plain", "value": message}],
        }
        if cc_email:
            payload["personalizations"][0]["cc"] = [{"email": cc_email}]

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
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


