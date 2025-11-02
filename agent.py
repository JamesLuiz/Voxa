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


async def collect_customer_info_if_needed(session: AgentSession, ctx, room_name: str, business_id: str):
    """Collect customer information if not already available."""
    # Always check both metadata and latest chat history for user info
    hist = get_room_history(room_name)
    collected = {'name': None, 'email': None, 'phone': None}
    
    # First, try to extract from room metadata (LiveKit or passed by frontend)
    metadata = getattr(ctx.room, 'metadata', {}) if hasattr(ctx.room, 'metadata') else {}
    if isinstance(metadata, str):
        try:
            import json as _json
            metadata = _json.loads(metadata)
        except Exception:
            metadata = {}
    if not isinstance(metadata, dict):
        metadata = {}
    
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
        ('name', "To proceed, may I have your full name? (We use this only for support)", lambda v: len(v.strip()) > 1),
        ('email', "Thank you. What's your email address? (Used for ticket updates)", lambda v: '@' in v and '.' in v),
        ('phone', "Great. Now please share your phone number (at least 10 digits, only for support)", lambda v: len(''.join(filter(str.isdigit, v))) >= 10),
    ]:
        while not collected[field]:
            await session.generate_reply(instructions=prompt_text)
            # Wait for user's next reply/message
            hist_len = len(hist)
            retry_count = 0
            max_retries = 30  # 15 seconds timeout
            
            while retry_count < max_retries:
                await asyncio.sleep(0.5)
                retry_count += 1
                
                # Check again for new message or metadata update
                metadata = getattr(ctx.room, 'metadata', {}) if hasattr(ctx.room, 'metadata') else {}
                if isinstance(metadata, str):
                    try:
                        import json as _json
                        metadata = _json.loads(metadata)
                    except Exception:
                        metadata = {}
                if not isinstance(metadata, dict):
                    metadata = {}
                
                if not collected[field] and metadata.get(field):
                    collected[field] = metadata.get(field)
                    break
                
                new_hist = get_room_history(room_name)
                if len(new_hist) > hist_len:
                    user_reply = new_hist[-1]['content']
                    if validate_fn(user_reply):
                        collected[field] = user_reply
                        hist = new_hist
                        break
                    else:
                        await session.generate_reply(instructions=f"Sorry, that is not a valid {field}, please try again.")
                        hist_len = len(new_hist)
                        retry_count = 0  # reset timeout after invalid input
                        break
    
    # Upsert customer to CRM
    import json as _json
    customer_result = await manage_customer.run(None, "upsert", {
        'businessId': business_id, 
        'name': collected['name'], 
        'email': collected['email'], 
        'phone': collected['phone']
    })
    
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
        # 1. Parse and normalize metadata FIRST (before any other operations)
        metadata = getattr(ctx.room, 'metadata', {}) if hasattr(ctx.room, 'metadata') else {}
        if isinstance(metadata, str):
            try:
                import json as _json
                metadata = _json.loads(metadata)
            except Exception:
                logger.debug(f"Failed to parse metadata as JSON: {metadata}")
                metadata = {'raw': metadata}
        if not isinstance(metadata, dict):
            metadata = {}

        user_role = metadata.get('role', 'customer')
        business_id = metadata.get('businessId', '')

        # 2. Fetch business context if we have a businessId
        business_context = {}
        if business_id:
            try:
                # Call the tool function directly
                from livekit.agents import RunContext
                mock_ctx = RunContext()
                # Store room reference if possible
                if hasattr(mock_ctx, 'room'):
                    try:
                        mock_ctx.room = ctx.room
                    except:
                        pass
                
                business_context_result = await get_business_context(mock_ctx, business_id)
                if business_context_result:
                    import json as _json
                    try:
                        business_context = _json.loads(business_context_result) if isinstance(business_context_result, str) else business_context_result
                    except Exception:
                        business_context = {}
            except Exception as e:
                logger.warning(f"Failed to fetch business context: {e}")

        # 3. Format the agent instruction with business context
        is_owner = (user_role == 'owner')
        agent_config = business_context.get('agentConfig', {}) if isinstance(business_context, dict) else {}
        
        formatted_instruction = AGENT_INSTRUCTION.format(
            business_name=business_context.get('name', 'the business') if isinstance(business_context, dict) else 'the business',
            business_description=business_context.get('description', '') if isinstance(business_context, dict) else '',
            products_list=', '.join(business_context.get('products', [])) if isinstance(business_context, dict) and isinstance(business_context.get('products'), list) else '',
            business_policies=business_context.get('policies', '') if isinstance(business_context, dict) else '',
            is_owner=is_owner,
            agent_tone=agent_config.get('tone', 'professional') if isinstance(agent_config, dict) else 'professional',
            response_style=agent_config.get('responseStyle', 'concise') if isinstance(agent_config, dict) else 'concise',
            business_hours=agent_config.get('businessHours', {}) if isinstance(agent_config, dict) else {},
            custom_prompt=agent_config.get('customPrompt', '') if isinstance(agent_config, dict) else ''
        )

        # 4. Create the session
        session = AgentSession()
        
        # 5. Start the session with room, agent, and input options (CRITICAL ORDER)
        await session.start(
            room=ctx.room,
            agent=Assistant(instructions=formatted_instruction),
            room_input_options=RoomInputOptions(
                video_enabled=True,
                noise_cancellation=noise_cancellation.BVC(),
            ),
        )
        
        # 6. Connect to the room (IMPORTANT - this was missing!)
        await ctx.connect()
        
        # 7. Setup timeout state for monitoring (must be before data handler)
        timeout_state = {'last_interaction': asyncio.get_event_loop().time(), 'question_pending': False, 'monitoring': True}
        
        # 8. Setup data handler for incoming messages
        async def _handle_incoming_data(payload, participant=None):
            try:
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
                    try:
                        raw = payload.data.decode('utf-8') if isinstance(payload.data, (bytes, bytearray)) else str(payload.data)
                    except Exception:
                        raw = None

                if raw:
                    import json as _json
                    try:
                        obj = _json.loads(raw)
                    except Exception:
                        # If not JSON, treat raw string as text message
                        text = raw if isinstance(raw, str) else str(raw)
                        obj = None

                    if obj:
                        if obj.get('type') == 'text_message' and obj.get('text'):
                            text = obj.get('text')
                        elif obj.get('text'):
                            # Also handle plain text in object
                            text = obj.get('text')
                    elif not text and raw:
                        # Raw string as fallback
                        text = raw

                if not text:
                    return

                # Update room-scoped history
                try:
                    rname = getattr(ctx.room, 'name', None)
                except Exception:
                    rname = None
                if rname:
                    update_history(rname, 'user', text)

                # Update interaction time for timeout monitoring
                try:
                    timeout_state['last_interaction'] = asyncio.get_event_loop().time()
                    timeout_state['question_pending'] = False
                except Exception:
                    pass

                # Generate spoken reply
                try:
                    await session.generate_reply(instructions=text)
                    # Mark that agent has asked a question (will be tracked by agent's response completion)
                    # For now, we'll track this by checking if agent finished speaking
                    timeout_state['question_pending'] = True
                    timeout_state['last_interaction'] = asyncio.get_event_loop().time()
                except Exception:
                    logger.exception('Failed to generate reply from data message')
            except Exception:
                logger.exception('Unhandled error in data message handler')
        
        # 6. Attach data handler
        try:
            attached = False
            if hasattr(session, 'on') and callable(getattr(session, 'on')):
                try: 
                    session.on('data', _handle_incoming_data)
                    attached = True
                except: 
                    pass
                try: 
                    session.on('data_received', _handle_incoming_data)
                    attached = True
                except: 
                    pass
            if not attached and hasattr(session, 'add_data_listener'):
                try: 
                    session.add_data_listener(_handle_incoming_data)
                    attached = True
                except: 
                    pass
            if not attached and hasattr(ctx.room, 'on'):
                try: 
                    ctx.room.on('data', _handle_incoming_data)
                    attached = True
                except: 
                    pass
                try:
                    ctx.room.on('data_received', _handle_incoming_data)
                    attached = True
                except:
                    pass
            if not attached:
                logger.debug('Could not attach data handler to session/room')
        except Exception:
            logger.exception('Error while trying to attach data handler')
        
        # Also listen to room data_received events
        try:
            if hasattr(ctx.room, 'on'):
                ctx.room.on('data_received', _handle_incoming_data)
        except Exception:
            logger.debug('Could not attach room data_received handler')

        # 8. Generate initial welcome message (session is now running)
        try:
            # Use different instruction based on role
            welcome_msg = SESSION_INSTRUCTION
            if is_owner:
                welcome_msg = "Hello! I'm Voxa, your AI business assistant. I can help you manage customers, tickets, analytics, and more. How can I assist you today?"
            await session.generate_reply(instructions=welcome_msg)
            # Mark that agent has asked a question initially
            timeout_state['question_pending'] = True
            timeout_state['last_interaction'] = asyncio.get_event_loop().time()
        except Exception:
            logger.exception('Failed to generate initial reply')

        # 9. For customers, fetch business context at start
        if user_role == 'customer' and business_id:
            try:
                # Business context already fetched above, but ensure it's available for tools
                logger.debug(f"Customer connected for business {business_id}")
            except Exception:
                logger.exception('Failed to prepare customer context')

        # 10. Collect customer info if needed (only for customers)
        if user_role == 'customer' and business_id:
            try:
                cust = await collect_customer_info_if_needed(session, ctx, ctx.room.name, business_id)
                await session.generate_reply(instructions=f"Thank you {cust.get('name')}, I have your info and can help further!")
            except Exception:
                logger.exception('Failed to collect customer info')

        # 17. Setup timeout monitoring for responses
        async def monitor_timeouts():
            while timeout_state.get('monitoring', False):
                try:
                    await asyncio.sleep(5)  # Check every 5 seconds
                    current_time = asyncio.get_event_loop().time()
                    elapsed = current_time - timeout_state.get('last_interaction', current_time)
                    pending = timeout_state.get('question_pending', False)
                    
                    if pending and elapsed >= 40:  # 40 seconds of no response
                        try:
                            await session.generate_reply(instructions="I haven't heard from you. I'll end this call now. Feel free to call back anytime!")
                            await asyncio.sleep(2)
                            await ctx.room.disconnect()
                            timeout_state['monitoring'] = False
                            break
                        except Exception:
                            pass
                    elif pending and elapsed >= 25:  # 25 seconds, give warning
                        try:
                            await session.generate_reply(instructions="I'm still waiting for your response. Please let me know if you're still there, or I'll end the call shortly.")
                        except Exception:
                            pass
                    elif pending and elapsed >= 15:  # 15 seconds, prompt again
                        try:
                            await session.generate_reply(instructions="Are you still there? Please let me know how I can help.")
                        except Exception:
                            pass
                except Exception:
                    pass
        
        # Start timeout monitoring
        timeout_task = asyncio.create_task(monitor_timeouts())
        
        # Also track when agent finishes speaking to mark question as pending
        # This would ideally hook into session events, but for now we'll use a simple approach
        
        # 18. Keep session alive - the session will run until the room ends
        # No need for await asyncio.Future() as the session manages its own lifecycle
        
    except Exception as e:
        try:
            room_name = getattr(ctx.room, 'name', 'unknown')
        except Exception:
            room_name = 'unknown'
        logger.exception(f"Unhandled exception in entrypoint for room {room_name}: {e}")
    finally:
        # Cleanup happens automatically when the function exits
        pass


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))