import os
from mistralai import Mistral
from livekit.agents import Agent, function_tool, RunContext
from livekit.plugins import google
from agent.history import get_room_history, update_history
from agent import get_logger
from tools import (
    get_weather,
    search_web,
    send_email,
    crm_lookup,
    create_ticket,
    schedule_meeting,
    get_customer_history,
    get_business_context,
    manage_customer,
    update_ticket,
    get_analytics,
    list_tickets,
)

logger = get_logger(__name__)
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))


class Assistant(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(
            instructions=instructions,
            llm=google.beta.realtime.RealtimeModel(
                voice="Aoede",
                temperature=0.6,  # Reduced from 0.8 for faster, more focused responses
                # Enable response optimization for faster replies
                response_modalities=["audio", "text"],
            ),
            tools=[
                get_weather,
                search_web,
                send_email,
                crm_lookup,
                create_ticket,
                schedule_meeting,
                get_customer_history,
                get_business_context,
                manage_customer,
                update_ticket,
                get_analytics,
                list_tickets,
            ],
        )

    @function_tool(
        description="Use advanced reasoning for complex analysis, data interpretation, or multi-step problem solving. Use this for queries that require deep analysis, logic, or detailed explanations."
    )
    def deep_reasoning(self, run_ctx: RunContext, query: str) -> str:
        try:
            logger.debug(f"Using Mistral for deep reasoning: {query[:50]}...")

            room_name = getattr(run_ctx, 'room', None)
            if room_name is not None and hasattr(room_name, 'name'):
                room_name = room_name.name

            messages = [{"role": "system", "content": "You are an expert reasoning assistant. Provide clear, logical, and detailed analysis."}]
            if room_name:
                hist = get_room_history(room_name)
                messages.extend(hist[-5:])

            messages.append({"role": "user", "content": query})

            completion = mistral_client.chat.complete(
                model="mistral-medium",
                messages=messages,
            )

            response = completion.choices[0].message.content
            logger.debug("Mistral reasoning complete")

            if room_name:
                update_history(room_name, "user", query)
                update_history(room_name, "assistant", response)

            return response

        except Exception as e:
            logger.warning(f"Mistral reasoning failed: {e}")
            return f"I encountered an error while processing that request: {str(e)}"


