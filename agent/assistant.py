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
        # Initialize with base tools first
        super().__init__(
            instructions=instructions,
            llm=google.beta.realtime.RealtimeModel(
                voice="Aoede",
                temperature=0.6,  # Reduced from 0.8 for faster, more focused responses
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
        # Note: The @function_tool decorator on deep_reasoning should make it automatically available
        # If it doesn't work, we may need to register it explicitly via the Agent's tool system

    @function_tool(
        description="Use advanced reasoning for complex analysis, data interpretation, or multi-step problem solving. Use this for queries that require deep analysis, logic, or detailed explanations. ALWAYS use this tool when: 1) The user asks about complex topics, broad contexts, or requires detailed analysis, 2) You need to reason through multiple steps or interpret data, 3) The question requires deeper understanding beyond simple facts, 4) You need to synthesize information from multiple sources (like search results) into a coherent answer. This tool uses Mistral AI for superior reasoning capabilities."
    )
    def deep_reasoning(self, run_ctx: RunContext, query: str) -> str:
        """
        Use Mistral AI for deep reasoning and complex analysis.
        This is especially useful when you have search results or need to analyze complex topics.
        """
        try:
            logger.info(f"Using Mistral for deep reasoning: {query[:100]}...")

            room_name = getattr(run_ctx, 'room', None)
            if room_name is not None and hasattr(room_name, 'name'):
                room_name = room_name.name

            # Enhanced system prompt for better reasoning with search results
            system_prompt = """You are an expert reasoning assistant with access to current information and search results. 
            
            CRITICAL INSTRUCTIONS:
            1. If the query includes search results or data, you MUST use that information in your response
            2. Extract and analyze ALL information from search results - don't dismiss any data
            3. Synthesize search results into coherent insights and explanations
            4. If search results are provided, they take priority over general knowledge
            5. Explain complex topics in an accessible way while maintaining accuracy
            6. Cite specific information from search results when relevant
            7. Even if search results are limited, use whatever information is available
            8. Never say "there's no information" - always work with what you have
            
            Provide clear, logical, and detailed analysis based on the information provided."""

            messages = [{"role": "system", "content": system_prompt}]
            
            # Include recent conversation history for context
            if room_name:
                hist = get_room_history(room_name)
                # Include more context (last 10 messages) for better reasoning
                messages.extend(hist[-10:])

            messages.append({"role": "user", "content": query})

            completion = mistral_client.chat.complete(
                model="mistral-medium",
                messages=messages,
            )

            response = completion.choices[0].message.content
            logger.info(f"Mistral reasoning complete: {len(response)} chars")

            if room_name:
                update_history(room_name, "user", query)
                update_history(room_name, "assistant", response)

            return response

        except Exception as e:
            logger.error(f"Mistral reasoning failed: {e}", exc_info=True)
            return f"I encountered an error while processing that request: {str(e)}"


