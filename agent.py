from dotenv import load_dotenv
import os
import logging
import sys
import asyncio
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


async def collect_customer_info_if_needed(session: AgentSession, ctx, room_name:str, business_id:str):
    # Always check both metadata and latest chat history for user info
    hist = get_room_history(room_name)
    collected = {'name': None, 'email': None, 'phone': None}
    # First, try to extract from room metadata (LiveKit or passed by frontend)
    metadata = getattr(ctx.room, 'metadata', {}) if hasattr(ctx.room, 'metadata') else {}
    for k in collected:
        if not collected[k] and metadata.get(k):
            collected[k] = metadata.get(k)
    # Then try history/messages (including any system messages injected by frontend)
    for m in reversed(hist):
        if not collected['name'] and ('name:' in m['content'].lower() or m['content'].lower().startswith('my name')):
            collected['name'] = m['content'].split(':')[-1].strip()
        if not collected['email'] and ('@' in m['content'] and '.' in m['content']):
            collected['email'] = m['content'].strip()
        if not collected['phone'] and any(digit.isdigit() for digit in m['content']):
            p = ''.join(filter(str.isdigit, m['content']))
            if len(p) >= 10:
                collected['phone'] = m['content']
    # Prompt for missing, one at a time, validating at each step
    for field, prompt_text, validate_fn in [
        ('name', "To proceed, may I have your full name? (We use this only for support)", lambda v: len(v.strip())>1),
        ('email', "Thank you. What's your email address? (Used for ticket updates)", lambda v: '@' in v and '.' in v),
        ('phone', "Great. Now please share your phone number (at least 10 digits, only for support)", lambda v: len(''.join(filter(str.isdigit, v))) >= 10),
    ]:
        while not collected[field]:
            await session.generate_reply(instructions=prompt_text)
            # Wait for user's next reply/message (assume it is queued to room history)
            # (each step, double-check if metadata was updated and break early if so...)
            while True:
                await asyncio.sleep(0.5)
                # Check again for new message or metadata update
                metadata = getattr(ctx.room, 'metadata', {}) if hasattr(ctx.room, 'metadata') else {}
                if not collected[field] and metadata.get(field):
                    collected[field] = metadata.get(field)
                    break
                new_hist = get_room_history(room_name)
                if len(new_hist)>len(hist):
                    user_reply = new_hist[-1]['content']
                    if validate_fn(user_reply):
                        collected[field] = user_reply
                        break
                    else:
                        await session.generate_reply(instructions=f"Sorry, that is not a valid {field}, please try again.")
                else:
                    continue
    # Upsert customer to CRM as before...
    import json as _json
    customer_result = await manage_customer.run(None, "upsert", {'businessId': business_id, 'name': collected['name'], 'email': collected['email'], 'phone': collected['phone']})
    try:
        cust = _json.loads(customer_result) if customer_result else None
        if not cust or not cust.get('_id'):
            await session.generate_reply(instructions="Sorry, I couldn't set up your support info. Please try again or contact admin.")
            raise Exception('Customer upsert failed')
    except Exception:
        raise
    return cust


# ------------------ ENTRYPOINT ------------------
async def entrypoint(ctx: agents.JobContext):
    logger.debug(f"Agent joining room: {ctx.room.name}")
    session = None
    try:
        session = AgentSession()
        # 1. Attach all message handlers/data handlers BEFORE any prompts or onboarding logic
        # (code for this part remains, but move up before onboarding below...)
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
        # Attach handler immediately here, so history is filled as soon as user connects (prevents missing customer replies)
        try:
            attached = False
            if hasattr(session, 'on') and callable(getattr(session, 'on')):
                try: session.on('data', _handle_incoming_data); attached = True
                except: pass
                try: session.on('data_received', _handle_incoming_data); attached = attached or True
                except: pass
            if not attached and hasattr(session, 'add_data_listener') and callable(getattr(session, 'add_data_listener')):
                try: session.add_data_listener(_handle_incoming_data); attached = True
                except: pass
            if not attached and hasattr(ctx.room, 'on') and callable(getattr(ctx.room, 'on')):
                try: ctx.room.on('data', _handle_incoming_data); attached = True
                except: pass
                try: ctx.room.on('data_received', _handle_incoming_data); attached = attached or True
                except: pass
            if not attached:
                logger.debug('Could not attach data handler to session/room; data messages may be ignored')
        except Exception:
            logger.exception('Error while trying to attach data handler')
        # 2. Proceed with rest of agent flow (as before)
        # ... then fetch metadata & onboarding/collect ...
        # ... rest of function as before ...
        # Initial welcome message
        try:
            await session.generate_reply(instructions=SESSION_INSTRUCTION)
        except Exception:
            # non-fatal: log and continue; don't allow a single failure to stop the worker
            logger.exception('Failed to generate initial reply')

        # (call this function, if role==customer)
        metadata = getattr(ctx.room, 'metadata', {}) if hasattr(ctx.room, 'metadata') else {}
        user_role = metadata.get('role', 'customer')
        business_id = metadata.get('businessId', '')
        if user_role == 'customer' and business_id:
            cust = await collect_customer_info_if_needed(session, ctx, ctx.room.name, business_id)
            # Optionally: store in session or push confirmation to agent context
            await session.generate_reply(instructions=f"Thank you {cust.get('name')}, I have your info and can help further!")

        # Wait or perform any additional lifecycle handling here if needed
    except Exception as e:
        # Log but don't re-raise; keep the worker process alive
        try:
            room_name = getattr(ctx.room, 'name', 'unknown')
        except Exception:
            room_name = 'unknown'
        logger.exception(f"Unhandled exception in entrypoint for room {room_name}: {e}")
    finally:
        # Ensure session is stopped/closed gracefully but don't kill the process
        try:
            if session:
                # Some session implementations expose stop/close methods
                if hasattr(session, 'stop') and callable(getattr(session, 'stop')):
                    try:
                        await session.stop()
                    except Exception:
                        logger.debug('session.stop() failed or not needed')
                elif hasattr(session, 'close') and callable(getattr(session, 'close')):
                    try:
                        await session.close()
                    except Exception:
                        logger.debug('session.close() failed or not needed')
        except Exception:
            logger.exception('Error during session cleanup')


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))