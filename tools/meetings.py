import logging
from livekit.agents import function_tool, RunContext
import requests
import os
from typing import Optional

logger = logging.getLogger(__name__)

@function_tool()
async def schedule_meeting(
    context: RunContext,  # type: ignore
    title: str,
    start_time: str,
    duration_minutes: int = 30,
    attendees: Optional[str] = None,
    customer_id: Optional[str] = None,
) -> str:
    """
    Schedule a meeting or appointment.
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        headers = {}
        api_key = os.getenv('BACKEND_API_KEY', '')
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        business_id = None
        if context:
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
            return "Error: Business ID is required to schedule a meeting. Please ensure you're connected with business context."

        attendees_list = []
        if attendees:
            if isinstance(attendees, str):
                attendees_list = [a.strip() for a in attendees.split(",") if a.strip()]
            elif isinstance(attendees, list):
                attendees_list = attendees

        customer_id_to_use = customer_id
        if not customer_id_to_use and attendees_list:
            first_attendee = attendees_list[0]
            if '@' in first_attendee:
                try:
                    customer_resp = requests.get(
                        f"{backend_url}/api/crm/customers/email/{first_attendee}",
                        params={"businessId": business_id},
                        headers=headers,
                        timeout=5,
                    )
                    if customer_resp.status_code == 200:
                        customer_data = customer_resp.json()
                        customer_id_to_use = customer_data.get('_id') or customer_data.get('id')
                except Exception:
                    pass

        meeting_data = {
            "businessId": business_id,
            "title": title,
            "startTime": start_time,
            "duration": duration_minutes,
            "attendees": attendees_list,
            "status": "scheduled",
        }
        if customer_id_to_use:
            meeting_data["customerId"] = customer_id_to_use

        response = requests.post(
            f"{backend_url}/api/meetings",
            json=meeting_data,
            headers=headers,
            timeout=10,
        )
        if response.status_code in (200, 201):
            meeting = response.json()
            meeting_id = meeting.get('_id') or meeting.get('id')
            logger.info(f"Created meeting: {meeting_id}")
            attendee_str = ", ".join(attendees_list) if attendees_list else "No attendees specified"
            return f"Meeting '{title}' scheduled successfully for {start_time} with {attendee_str}. Meeting ID: {meeting_id}"
        else:
            error_text = response.text
            logger.warning(f"Failed to create meeting: {response.status_code} - {error_text}")
            return f"Failed to schedule meeting: {error_text}"

    except Exception as e:
        logger.warning(f"Error scheduling meeting: {e}")
        return f"An error occurred while scheduling meeting: {str(e)}"


