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
    get_business_context,
    manage_customer,
    update_ticket,
    get_analytics,
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

# Conversation memory scoped by room name so reconnecting participants
# (even with a new identity) can pick up prior context for the same room.
conversation_histories: dict = {}
HISTORY_LIMIT = 10

# Redis client (optional). If REDIS_URL is set and redis package is available,
# we'll persist room histories to Redis so they survive agent restarts and can
# be shared across workers.
try:
    import redis as _redis
    _redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
    try:
        redis_client = _redis.from_url(_redis_url)
    except Exception:
        # older redis versions: StrictRedis
        redis_client = _redis.StrictRedis.from_url(_redis_url)
except Exception:
    redis_client = None


def get_room_history(room_name: str):
    if room_name not in conversation_histories:
        # Try to load from Redis if available
        if redis_client:
            try:
                raw = redis_client.get(f"voxa:history:{room_name}")
                if raw:
                    try:
                        import json as _json
                        conversation_histories[room_name] = _json.loads(raw)
                    except Exception:
                        conversation_histories[room_name] = []
                else:
                    conversation_histories[room_name] = []
            except Exception:
                conversation_histories[room_name] = []
        else:
            conversation_histories[room_name] = []
    return conversation_histories[room_name]


def update_history(room_name: str, role: str, content: str):
    """Update conversation history for a specific room with size limit."""
    hist = get_room_history(room_name)
    hist.append({"role": role, "content": content})
    if len(hist) > HISTORY_LIMIT:
        hist.pop(0)
    # Persist to Redis (best-effort)
    if redis_client:
        try:
            import json as _json
            redis_client.set(f"voxa:history:{room_name}", _json.dumps(hist))
        except Exception:
            logger.debug('Failed to persist room history to Redis')


# ------------------ ASSISTANT ------------------
class Assistant(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(
            instructions=instructions,
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
                get_business_context,
                manage_customer,
                update_ticket,
                get_analytics,
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

            # Attempt to derive room name from run_ctx if present so we can
            # include room-scoped history. Fall back to global short history.
            room_name = getattr(run_ctx, 'room', None)
            if room_name is not None and hasattr(room_name, 'name'):
                room_name = room_name.name

            messages = [{"role": "system", "content": "You are an expert reasoning assistant. Provide clear, logical, and detailed analysis."}]

            if room_name:
                hist = get_room_history(room_name)
                # include up to last 5 messages
                messages.extend(hist[-5:])
            else:
                # fallback: no room scope available
                messages.extend([])

            messages.append({"role": "user", "content": query})

            completion = mistral_client.chat.complete(
                model="mistral-medium",
                messages=messages,
            )

            response = completion.choices[0].message.content
            logger.debug("Mistral reasoning complete")

            # Update room history if possible
            if room_name:
                update_history(room_name, "user", query)
                update_history(room_name, "assistant", response)

            return response

        except Exception as e:
            logger.warning(f"Mistral reasoning failed: {e}")
            return f"I encountered an error while processing that request: {str(e)}"


# ------------------ ENTRYPOINT ------------------
async def entrypoint(ctx: agents.JobContext):
    logger.debug(f"Agent joining room: {ctx.room.name}")
    
    session = AgentSession()
    
    # Extract business and role metadata
    business_id = None
    user_role = None
    try:
        business_id = (ctx.room.metadata or {}).get('businessId')
        user_role = (ctx.room.metadata or {}).get('role')  # 'owner' or 'customer'
    except Exception:
        pass

    # Fetch business context for prompt
    agent_prompt = AGENT_INSTRUCTION
    try:
        if business_id:
            # tools.get_business_context returns raw JSON text; parse minimally
            import json as _json
            raw = await get_business_context.run(None, business_id)
            data = _json.loads(raw) if raw else {}
            agent_prompt = AGENT_INSTRUCTION.format(
                business_name=data.get('name', 'Your Business'),
                business_description=data.get('description', ''),
                products_list='\n'.join(data.get('products', [])),
                business_policies=data.get('policies', ''),
                is_owner=(user_role == 'owner'),
                agent_tone=(data.get('agentConfig', {}) or {}).get('tone', 'professional'),
                response_style=(data.get('agentConfig', {}) or {}).get('responseStyle', 'concise'),
                business_hours=(data.get('agentConfig', {}) or {}).get('businessHours', {}),
                custom_prompt=(data.get('agentConfig', {}) or {}).get('customPrompt', ''),
            )
    except Exception as e:
        logger.warning(f"Failed to build agent prompt: {e}")

    try:
        await session.start(
            room=ctx.room,
            agent=Assistant(agent_prompt),
            room_input_options=RoomInputOptions(
                video_enabled=True,
                noise_cancellation=noise_cancellation.BVC(),
            ),
        )

        # Connect to the job context. This yields until the room/job ends.
        await ctx.connect()

        # Initial welcome message
        try:
            await session.generate_reply(instructions=SESSION_INSTRUCTION)
        except Exception:
            # non-fatal: log and continue; don't allow a single failure to stop the worker
            logger.exception('Failed to generate initial reply')

        # Register a defensive handler for room data messages so the agent can
        # handle text messages forwarded from the backend. Different versions
        # of the LiveKit agent/room object expose different subscription APIs,
        # so we try a few common ones.
        async def _handle_incoming_data(payload, participant=None):
            try:
                # payload may be bytes or str or already-decoded
                text = None
                raw = None
                if isinstance(payload, (bytes, bytearray)):
                    try:
                        raw = payload.decode('utf-8')
                    except Exception:
                        raw = None
                elif isinstance(payload, str):
                    raw = payload
                elif hasattr(payload, 'data'):
                    # some SDKs wrap a packet with .data
                    try:
                        raw = payload.data.decode('utf-8') if isinstance(payload.data, (bytes, bytearray)) else str(payload.data)
                    except Exception:
                        raw = None

                if raw:
                    import json as _json
                    try:
                        obj = _json.loads(raw)
                    except Exception:
                        obj = None

                    if obj and obj.get('type') == 'text_message' and obj.get('text'):
                        text = obj.get('text')

                if not text:
                    # nothing for us to do
                    return

                # update room-scoped history
                try:
                    rname = getattr(ctx.room, 'name', None)
                except Exception:
                    rname = None
                if rname:
                    update_history(rname, 'user', text)

                # Generate spoken reply using the session helper — keep it robust
                try:
                    await session.generate_reply(instructions=text)
                except Exception:
                    logger.exception('Failed to generate reply from data message')
            except Exception:
                logger.exception('Unhandled error in data message handler')

        # Attempt to attach the handler. Try multiple common hook names.
        try:
            attached = False
            # session.on('data'|'data_received')
            if hasattr(session, 'on') and callable(getattr(session, 'on')):
                try:
                    session.on('data', _handle_incoming_data)
                    attached = True
                except Exception:
                    try:
                        session.on('data_received', _handle_incoming_data)
                        attached = True
                    except Exception:
                        attached = attached or False

            # session.add_data_listener
            if not attached and hasattr(session, 'add_data_listener') and callable(getattr(session, 'add_data_listener')):
                try:
                    session.add_data_listener(_handle_incoming_data)
                    attached = True
                except Exception:
                    attached = attached or False

            # ctx.room.on
            if not attached and hasattr(ctx.room, 'on') and callable(getattr(ctx.room, 'on')):
                try:
                    ctx.room.on('data', _handle_incoming_data)
                    attached = True
                except Exception:
                    try:
                        ctx.room.on('data_received', _handle_incoming_data)
                        attached = True
                    except Exception:
                        attached = attached or False

            if not attached:
                logger.debug('Could not attach data handler to session/room; data messages may be ignored')
        except Exception:
            logger.exception('Error while trying to attach data handler')

        logger.debug("Agent ready for conversation.")

        # Wait for the job to finish. Some SDKs provide a wait or block until disconnect
        # If JobContext exposes an awaitable method for lifecycle, use it; otherwise
        # rely on ctx to manage the lifetime. We simply return from the entrypoint
        # when ctx.connect() completes or an exception occurs.
        # Keep the process alive by not raising exceptions beyond this function.
        
    except Exception as e:
        # Log but don't re-raise; keep the worker process alive
        logger.exception(f"Unhandled exception in entrypoint for room {ctx.room.name}: {e}")
    finally:
        # Ensure session is stopped/closed gracefully but don't kill the process
        try:
            if session:
                # Some session implementations expose stop/close methods
                if hasattr(session, 'stop') and callable(session.stop):
                    try:
                        await session.stop()
                    except Exception:
                        logger.debug('session.stop() failed or not needed')
                elif hasattr(session, 'close') and callable(session.close):
                    try:
                        await session.close()
                    except Exception:
                        logger.debug('session.close() failed or not needed')
        except Exception:
            logger.exception('Error during session cleanup')


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))