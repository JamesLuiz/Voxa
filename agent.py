from dotenv import load_dotenv
import os
import logging
import sys
from mistralai import Mistral

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions, function_tool, RunContext
from livekit.plugins import noise_cancellation, google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from tools import (
    get_weather,
    search_web,
    send_email,
    crm_lookup,
    create_ticket,
    schedule_meeting,
    get_customer_history,
)

# ------------------ SETUP ------------------
load_dotenv()

# Configure logging based on environment
def setup_logging():
    """Setup logging configuration based on execution mode"""
    # Check if running in development/console mode
    is_console_mode = any(arg in sys.argv for arg in ['console', 'dev', '--dev', '--console'])
    
    if is_console_mode:
        # Full logging for console/dev mode
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    else:
        # Only warnings and errors for prod/start
        logging.basicConfig(
            level=logging.WARNING,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        
        # Aggressively suppress ALL external library logs in prod mode
        for logger_name in ['livekit', 'livekit.agents', 'mistralai', 'httpx', 'httpcore', 
                           'urllib3', 'google', 'openai', 'langchain']:
            logging.getLogger(logger_name).setLevel(logging.ERROR)
            logging.getLogger(logger_name).propagate = False

setup_logging()

# Disable LiveKit's internal logging in production
if 'start' in sys.argv or 'prod' in sys.argv:
    # Set root logger to ERROR to catch everything
    logging.getLogger().setLevel(logging.ERROR)
    
    # Create our own logger for warnings only
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.WARNING)
else:
    logger = logging.getLogger(__name__)

# Initialize Mistral client (NEW API)
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

# Conversation memory
conversation_history = []
HISTORY_LIMIT = 10

def update_history(role: str, content: str):
    """Update conversation history with memory management."""
    conversation_history.append({"role": role, "content": content})
    if len(conversation_history) > HISTORY_LIMIT:
        conversation_history.pop(0)


# ------------------ ASSISTANT ------------------
class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=AGENT_INSTRUCTION,
            llm=google.beta.realtime.RealtimeModel(
                voice="Aoede",
                temperature=0.8,
            ),
            tools=[
                get_weather,
                search_web,
                send_email,
                crm_lookup,
                create_ticket,
                schedule_meeting,
                get_customer_history,
            ],
        )
    
    @function_tool(
        description="Use advanced reasoning for complex analysis, data interpretation, or multi-step problem solving. Use this for queries that require deep analysis, logic, or detailed explanations."
    )
    def deep_reasoning(self, run_ctx: RunContext, query: str) -> str:
        """
        Performs deep reasoning using Mistral for complex queries.
        
        Args:
            query: The question or problem that requires advanced reasoning
        """
        try:
            logger.debug(f"Using Mistral for deep reasoning: {query[:50]}...")
            
            # Build context from conversation history
            messages = [
                {"role": "system", "content": "You are an expert reasoning assistant. Provide clear, logical, and detailed analysis."},
                *conversation_history[-5:],  # Include recent context
                {"role": "user", "content": query}
            ]
            
            completion = mistral_client.chat.complete(
                model="mistral-medium",
                messages=messages,
            )
            
            response = completion.choices[0].message.content
            logger.debug("Mistral reasoning complete")
            
            # Update history
            update_history("user", query)
            update_history("assistant", response)
            
            return response
            
        except Exception as e:
            logger.warning(f"Mistral reasoning failed: {e}")
            return f"I encountered an error while processing that request: {str(e)}"


# ------------------ ENTRYPOINT ------------------
async def entrypoint(ctx: agents.JobContext):
    logger.debug(f"Agent joining room: {ctx.room.name}")
    
    session = AgentSession()
    
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            video_enabled=True,
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )
    
    await ctx.connect()
    
    # Initial welcome message
    await session.generate_reply(instructions=SESSION_INSTRUCTION)
    
    logger.debug("Agent ready for conversation.")


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))