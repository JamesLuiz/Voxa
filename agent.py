from dotenv import load_dotenv
import os
import logging
import sys
import asyncio
from mistralai import Mistral

from livekit import agents, rtc
from livekit.agents import AgentSession, RoomInputOptions
from livekit.plugins import noise_cancellation
from prompts import AGENT_INSTRUCTION, CUSTOMER_CARE_INSTRUCTION, SESSION_INSTRUCTION
from tools import (
    get_business_context,
    manage_customer,
)

from agent import setup_logging, get_logger

# ------------------ SETUP ------------------
load_dotenv()
setup_logging()
logger = get_logger(__name__)

# Initialize Mistral client (NEW API)
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

from typing import Any

# Quick startup backend connectivity check to help debug DB/backend reachability
def check_backend_connectivity() -> None:
    try:
        import requests
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:3000')
        health = requests.get(f"{backend_url}/api/business/resolve", timeout=3)
        if health.ok:
            try:
                data = health.json()
                logger.info(f"Backend reachable: resolved business {data.get('businessId') or data.get('name', '(none)')}")
            except Exception:
                logger.info("Backend reachable: /api/business/resolve returned non-json response")
        else:
            logger.warning(f"Backend responded but returned status {health.status_code}")
    except Exception as e:
        logger.warning(f"Backend connectivity check failed: {e}")


# Run the connectivity check at import/startup (best-effort)
try:
    check_backend_connectivity()
except Exception:
    pass

# Warn if BACKEND_API_KEY is not configured - many protected backend endpoints
# expect this key when tools call into the backend.
if not os.getenv('BACKEND_API_KEY'):
    logger.warning('BACKEND_API_KEY not set in environment - protected backend endpoints may return 401 or empty responses')

from agent import safe_generate_reply
from agent.history import (
    get_room_history,
    update_history,
    persist_user_message_if_possible,
    persist_assistant_message_if_possible,
    room_user_identity,
)


from agent.assistant import Assistant


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
                try:
                    await safe_generate_reply(session, ctx, prompt_text, timeout=30.0)
                except Exception as e:
                    logger.warning(f"Failed to send prompt for {field}: {e}")
                    # Continue anyway - user might respond
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
                            try:
                                await safe_generate_reply(session, ctx, f"Sorry, that is not a valid {field}, please try again.", timeout=30.0)
                            except Exception as e:
                                logger.warning(f"Failed to send validation error message: {e}")
                            hist_len = len(new_hist)
                            retry_count = 0  # reset timeout after invalid input
                            break
    
    # Upsert customer to CRM
    import json as _json
    # Upsert customer to CRM. Use the provided run context so the tool
    # can extract businessId from the room metadata if needed.
    # Note: manage_customer is a function_tool and should be awaited directly.
    customer_result = None
    try:
        customer_result = await manage_customer(ctx, 'upsert', {
            'businessId': business_id,
            'name': collected['name'],
            'email': collected['email'],
            'phone': collected['phone']
        })
    except Exception as e:
        logger.warning(f"manage_customer upsert call failed: {e}")

    # Parse the result robustly: the tool returns either a JSON string or a dict
    cust = None
    try:
        if not customer_result:
            cust = None
        elif isinstance(customer_result, str):
            try:
                cust = _json.loads(customer_result)
            except Exception:
                # Some backends return plain text - fall back to empty
                cust = None
        elif isinstance(customer_result, dict):
            cust = customer_result

        if not cust or not cust.get('_id'):
            try:
                await safe_generate_reply(session, ctx, "Sorry, I couldn't set up your support info. Please try again or contact admin.", timeout=30.0)
            except Exception as e:
                logger.warning(f"Failed to send error message: {e}")
            raise Exception('Customer upsert failed')
    except Exception:
        raise
    
    # Update known identity for this room
    try:
        rname = room_name
        room_user_identity[rname] = {
            'role': 'customer',
            'email': cust.get('email') if isinstance(cust, dict) else None,
            'businessId': business_id
        }
    except Exception:
        pass
    return cust


# ------------------ ENTRYPOINT ------------------
async def entrypoint(ctx: agents.JobContext):
    logger.debug(f"Agent joining room: {ctx.room.name}")
    session = None
    
    try:
        # Setup disconnect handler to clean up properly
        async def handle_participant_disconnected(participant):
            """Handle when a participant disconnects"""
            try:
                identity = getattr(participant, 'identity', 'unknown')
                logger.debug(f"Participant disconnected: {identity}")
                # Don't exit - agent should stay alive for reconnections
            except Exception as e:
                logger.debug(f"Error handling participant disconnect: {e}")
        
        async def handle_participant_connected(participant):
            """Handle when a participant connects/reconnects"""
            try:
                identity = getattr(participant, 'identity', 'unknown')
                logger.debug(f"Participant connected/reconnected: {identity}")
                # Participant can reconnect - agent is ready
            except Exception as e:
                logger.debug(f"Error handling participant connect: {e}")
        
        # Listen for participant connection/disconnection events
        try:
            if hasattr(ctx.room, 'on'):
                ctx.room.on('participant_disconnected', handle_participant_disconnected)
                ctx.room.on('participant_connected', handle_participant_connected)
                logger.debug('Attached participant connection/disconnection handlers')
        except Exception as e:
            logger.debug(f"Could not attach participant event handlers: {e}")
    
    except Exception as e:
        logger.debug(f"Error in entrypoint setup: {e}")
    
    try:
        # 1. Parse and normalize metadata FIRST (before any other operations)
        # Try multiple methods to get metadata
        metadata = {}
        
        # Method 1: Room metadata
        room_meta = getattr(ctx.room, 'metadata', None)
        if room_meta:
            if isinstance(room_meta, str):
                try:
                    import json as _json
                    metadata = _json.loads(room_meta)
                except Exception:
                    logger.debug(f"Failed to parse room metadata as JSON: {room_meta}")
                    metadata = {}
            elif isinstance(room_meta, dict):
                metadata = room_meta.copy()
        
        # Method 2: Check if room name is a business ID (backend uses businessId as room name)
        room_name = getattr(ctx.room, 'name', '')
        if not metadata.get('businessId') and room_name and len(room_name) == 24 and room_name.isalnum():
            # Looks like MongoDB ObjectId - could be businessId
            metadata['businessId'] = room_name
            logger.debug(f"Using room name as businessId: {room_name}")
        
        # Method 3: Check participant metadata (if available)
        try:
            if hasattr(ctx.room, 'remote_participants'):
                for participant in ctx.room.remote_participants.values():
                    part_meta = getattr(participant, 'metadata', None)
                    if part_meta:
                        if isinstance(part_meta, str):
                            try:
                                import json as _json
                                part_dict = _json.loads(part_meta)
                                if isinstance(part_dict, dict):
                                    metadata.update(part_dict)
                            except Exception:
                                pass
                        elif isinstance(part_meta, dict):
                            metadata.update(part_meta)
                    break  # Just check first participant
        except Exception:
            pass

        if not isinstance(metadata, dict):
            metadata = {}

        # Merge participant attributes (if available) into metadata for role/name/email/businessId
        try:
            if hasattr(ctx.room, 'remote_participants') and isinstance(getattr(ctx.room, 'remote_participants'), dict):
                first_participant = None
                for _pid, _p in getattr(ctx.room, 'remote_participants').items():
                    first_participant = _p
                    break
                if first_participant is not None:
                    attrs = getattr(first_participant, 'attributes', None)
                    if isinstance(attrs, dict):
                        # Only fill keys that aren't already present in metadata
                        for k in ('role', 'businessId', 'userName', 'userEmail'):
                            if k not in metadata and k in attrs and attrs[k] is not None:
                                metadata[k] = attrs[k]
        except Exception:
            pass

        user_role = metadata.get('role', 'customer')
        business_id = metadata.get('businessId', '') or metadata.get('business_id', '') or metadata.get('business', '')
        is_owner = (user_role == 'owner')
        is_general = (user_role == 'general')
        
        # Log metadata for debugging
        logger.info(f"Agent entrypoint - Room: {ctx.room.name}, Role: {user_role}, BusinessId: {business_id}")
        logger.debug(f"Metadata keys: {list(metadata.keys()) if isinstance(metadata, dict) else 'not a dict'}")
        if isinstance(metadata, dict):
            logger.debug(f"Metadata userName: {metadata.get('userName')}, userEmail: {metadata.get('userEmail')}")

        # 2. Fetch business context if we have a businessId or can resolve one
        business_context = {}
        # Helpful extras: frontend may provide slug or owner email in metadata.
        slug_candidate = None
        if isinstance(metadata, dict):
            slug_candidate = metadata.get('slug') or metadata.get('businessSlug') or metadata.get('business_slug')

        if business_id:
            try:
                # Call the tool function directly
                from livekit.agents import RunContext
                mock_ctx = RunContext()
                # Store room reference if possible
                if hasattr(mock_ctx, 'room'):
                    try:
                        mock_ctx.room = ctx.room
                    except Exception:
                        pass

                business_context_result = await get_business_context(mock_ctx, business_id)
                if business_context_result:
                    import json as _json
                    try:
                        business_context = _json.loads(business_context_result) if isinstance(business_context_result, str) else business_context_result
                        logger.debug(f"Successfully fetched business context for {business_id}: {business_context.get('name', 'unknown')}")
                    except Exception:
                        business_context = {}
                else:
                    logger.warning(f"get_business_context returned empty result for businessId: {business_id}")
            except Exception as e:
                logger.warning(f"Failed to fetch business context: {e}")
        elif is_owner:
            # For owners, try to get businessId from metadata or try to resolve it
            logger.debug("Owner detected but no businessId in metadata, attempting to resolve")
            # Try to extract from room metadata more thoroughly
            if isinstance(metadata, dict):
                # Check for alternative metadata keys
                alt_business_id = metadata.get('businessId') or metadata.get('business_id') or metadata.get('business')
                if alt_business_id:
                    business_id = str(alt_business_id)
                    # Retry fetching with resolved businessId
                    try:
                        from livekit.agents import RunContext
                        mock_ctx = RunContext()
                        if hasattr(mock_ctx, 'room'):
                            try:
                                mock_ctx.room = ctx.room
                            except Exception:
                                pass
                        business_context_result = await get_business_context(mock_ctx, business_id)
                        if business_context_result:
                            import json as _json
                            try:
                                business_context = _json.loads(business_context_result) if isinstance(business_context_result, str) else business_context_result
                                logger.debug(f"Successfully fetched business context after resolution: {business_context.get('name', 'unknown')}")
                            except Exception:
                                business_context = {}
                    except Exception as e:
                        logger.warning(f"Failed to fetch business context after resolution: {e}")
            # If still no business_id, try resolving from owner email (metadata) via tools.get_owner_profile
            if not business_id and isinstance(metadata, dict):
                owner_email = metadata.get('userEmail') or metadata.get('ownerEmail') or metadata.get('email')
                if owner_email and isinstance(owner_email, str) and '@' in owner_email:
                    try:
                        from tools import get_owner_profile
                        from livekit.agents import RunContext
                        mock_ctx = RunContext()
                        if hasattr(mock_ctx, 'room'):
                            try:
                                mock_ctx.room = ctx.room
                            except Exception:
                                pass
                        owner_res = await get_owner_profile(mock_ctx, owner_email)
                        import json as _json
                        parsed = _json.loads(owner_res) if isinstance(owner_res, str) else owner_res
                        # If owner profile includes businessId or businesses list, pick first
                        if isinstance(parsed, dict):
                            found_bid = parsed.get('businessId') or parsed.get('business') or parsed.get('business_id')
                            if found_bid:
                                business_id = str(found_bid)
                                try:
                                    business_context_result = await get_business_context(mock_ctx, business_id)
                                    if business_context_result:
                                        business_context = _json.loads(business_context_result) if isinstance(business_context_result, str) else business_context_result
                                except Exception:
                                    pass
                    except Exception:
                        pass

        # If we still don't have a business_id but there is a slug provided (customer flow), try resolving by slug
        if (not business_id) and slug_candidate:
            try:
                from livekit.agents import RunContext
                mock_ctx = RunContext()
                if hasattr(mock_ctx, 'room'):
                    try:
                        mock_ctx.room = ctx.room
                    except Exception:
                        pass
                business_context_result = await get_business_context(mock_ctx, slug_candidate)
                if business_context_result:
                    import json as _json
                    try:
                        business_context = _json.loads(business_context_result) if isinstance(business_context_result, str) else business_context_result
                        # If resolved, try to extract businessId
                        if isinstance(business_context, dict):
                            resolved_id = business_context.get('businessId') or business_context.get('_id')
                            if resolved_id:
                                business_id = str(resolved_id)
                    except Exception:
                        business_context = {}
            except Exception:
                pass
    except Exception as e:
        logger.debug(f"Error preparing metadata/business context: {e}")

    # 3. Format the agent instruction with business context
    agent_config = business_context.get('agentConfig', {}) if isinstance(business_context, dict) else {}

    # Evaluate mode first to avoid format string issues
    mode_value = 'OWNER' if is_owner else ('GENERAL' if is_general else 'CUSTOMER')

    # Convert business_hours dict to string if needed
    business_hours_config = agent_config.get('businessHours', {}) if isinstance(agent_config, dict) else {}
    if isinstance(business_hours_config, dict):
        business_hours_str = ', '.join([f"{k}: {v}" for k, v in business_hours_config.items()]) if business_hours_config else '9-5'
    else:
        business_hours_str = str(business_hours_config) if business_hours_config else '9-5'

    formatted_instruction = AGENT_INSTRUCTION.format(
        business_name=business_context.get('name', 'the business') if isinstance(business_context, dict) else 'the business',
        business_description=business_context.get('description', '') if isinstance(business_context, dict) else '',
        products_list=', '.join(business_context.get('products', [])) if isinstance(business_context, dict) and isinstance(business_context.get('products'), list) else '',
        business_policies=business_context.get('policies', '') if isinstance(business_context, dict) else '',
        mode=mode_value,
        agent_tone=agent_config.get('tone', 'professional') if isinstance(agent_config, dict) else 'professional',
        response_style=agent_config.get('responseStyle', 'concise') if isinstance(agent_config, dict) else 'concise',
        business_hours_str=business_hours_str,
        custom_prompt=agent_config.get('customPrompt', '') if isinstance(agent_config, dict) else ''
    )

    # If customer role, append customer care guidance
    if not is_owner and not is_general:
        try:
            formatted_instruction = f"{formatted_instruction}\n\n{CUSTOMER_CARE_INSTRUCTION}"
        except Exception:
            pass

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

    # Fetch owner profile for owners to get name
    owner_name = None
    owner_info = {}
    if is_owner and business_id:
        try:
            from tools import get_owner_profile
            from livekit.agents import RunContext
            mock_ctx = RunContext()
            if hasattr(mock_ctx, 'room'):
                try:
                    mock_ctx.room = ctx.room
                except Exception:
                    pass
            owner_email = metadata.get('userEmail') or metadata.get('ownerEmail') or metadata.get('email')
            if owner_email:
                owner_res = await get_owner_profile(mock_ctx, owner_email)
                import json as _json
                parsed = _json.loads(owner_res) if isinstance(owner_res, str) else owner_res
                if isinstance(parsed, dict):
                    owner_info = parsed
                    owner_name = parsed.get('name')
            elif business_id:
                # Try fetching by business ID
                owner_res = await get_owner_profile(mock_ctx, business_id)
                parsed = _json.loads(owner_res) if isinstance(owner_res, str) else owner_res
                if isinstance(parsed, dict):
                    owner_info = parsed
                    owner_name = parsed.get('name')
        except Exception as e:
            logger.debug(f"Could not fetch owner profile: {e}")
    
    # Fallback to metadata userName if available
    if not owner_name and metadata.get('userName'):
        owner_name = metadata.get('userName')
    
    # Get business name from context
    business_name = business_context.get('name', 'the business') if isinstance(business_context, dict) else 'the business'
    
    # Create role-specific welcome message
    welcome_message = SESSION_INSTRUCTION  # Default fallback
    
    if is_owner:
        if owner_name and business_name != 'the business':
            welcome_message = f"Hi {owner_name}! Welcome back to your Voxa business assistant for {business_name}. I'm here to help you manage your business, handle customer inquiries, and keep everything running smoothly. What would you like to focus on today?"
        elif owner_name:
            welcome_message = f"Hi {owner_name}! Welcome back to your Voxa business assistant. I'm here to help you manage your business, handle customer inquiries, and keep everything running smoothly. What would you like to focus on today?"
        elif business_name != 'the business':
            welcome_message = f"Hi! Welcome back to your Voxa business assistant for {business_name}. I'm here to help you manage your business, handle customer inquiries, and keep everything running smoothly. What would you like to focus on today?"
        else:
            welcome_message = "Hi! Welcome back to your Voxa business assistant. I'm here to help you manage your business, handle customer inquiries, and keep everything running smoothly. What would you like to focus on today?"
    elif is_general:
        general_name = metadata.get('userName') or metadata.get('name')
        if general_name:
            welcome_message = f"Hey {general_name}! I'm Voxa. I can help with info, support, and more. What would you like help with today?"
        else:
            welcome_message = "Hey! I'm Voxa. I can help with info, support, and more. What's your name?"
    else:
        # Customer mode
        if business_name != 'the business':
            welcome_message = f"Hi there! I'm Voxa, your AI assistant for {business_name}. I'm here to help with whatever you need. To get started and provide you with the best support, I'll just need a few quick details from you. Don't worry, your information stays completely secure and is only used for support purposes."
        else:
            welcome_message = "Hi there! I'm Voxa, your AI assistant. I'm here to help with whatever you need. To get started and provide you with the best support, I'll just need a few quick details from you. Don't worry, your information stays completely secure and is only used for support purposes."
    
    # Send initial session welcome message once on connect
    try:
        await safe_generate_reply(session, ctx, welcome_message, timeout=30.0)
    except Exception:
        pass

    # 6. Connect to the room (IMPORTANT - this was missing!)
    await ctx.connect()
        
    # 7. Setup timeout state for monitoring (must be before data handler)
    # Timeout state removed - no longer monitoring timeouts

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
            # Persist user message if possible
            try:
                await persist_user_message_if_possible(ctx, user_role, text, business_id)
            except Exception:
                pass

            # Generate spoken reply with centralized timeout/error handling
            try:
                await safe_generate_reply(session, ctx, text, timeout=30.0)

                # Send text response back via data channel so frontend can display it
                try:
                    import json as _json
                    response_data = _json.dumps({
                        'type': 'agent_response',
                        'text': text  # The agent's response will be in the transcription/response
                    })
                    # Try to send via room data channel
                    if hasattr(ctx.room, 'local_participant'):
                        try:
                            await ctx.room.local_participant.publish_data(
                                response_data.encode('utf-8'),
                                reliable=True
                            )
                        except:
                            pass
                except Exception:
                    pass  # Don't fail if we can't send text response
            except Exception:
                logger.exception('Failed to generate reply from data message')
        except Exception:
            logger.exception('Unhandled error in data message handler')

    # 6. Attach data handler for text messages
        # According to LiveKit docs, agents receive text via lk.chat topic
        # We need to listen to participant data events
        async def _handle_participant_data(message, participant=None):
            """Handle data messages from participants (text messages via lk.chat topic)"""
            try:
                # Extract data from message - handle different types
                raw = None
                topic = None
                
                # If message is a DataPacket
                if hasattr(message, 'data'):
                    data = message.data
                    topic = getattr(message, 'topic', None) or getattr(message, 'topic', '') or ''
                    
                    if isinstance(data, (bytes, bytearray)):
                        try:
                            raw = data.decode('utf-8')
                        except:
                            raw = None
                    else:
                        raw = str(data) if data else None
                # If message is bytes/string directly
                elif isinstance(message, (bytes, bytearray)):
                    try:
                        raw = message.decode('utf-8')
                    except:
                        raw = None
                elif isinstance(message, str):
                    raw = message
                # If it's a dict with data
                elif isinstance(message, dict):
                    raw = message.get('data') or message.get('text') or str(message)
                    topic = message.get('topic', '')
                
                # Process if we have data (check topic if available)
                # Accept messages with lk.chat topic OR no topic (fallback for compatibility)
                should_process = False
                if topic:
                    if topic == 'lk.chat':
                        should_process = True
                else:
                    # No topic specified - check if message looks like text
                    should_process = True
                
                if raw and should_process:
                    # Try to parse as JSON
                    import json as _json
                    text = None
                    try:
                        obj = _json.loads(raw)
                        if isinstance(obj, dict):
                            # Extract text from various possible fields
                            text = obj.get('text') or obj.get('message') or obj.get('data') or raw
                            # Also check if topic is in the object
                            obj_topic = obj.get('topic', '')
                            if obj_topic and obj_topic != 'lk.chat' and topic and topic != 'lk.chat':
                                # Skip if topic doesn't match
                                return
                        else:
                            text = raw
                    except:
                        # Not JSON, treat as plain text
                        text = raw
                    
                    if text and text.strip():
                        logger.debug(f"Received text message from participant: {text[:100]}")
                        # Update room history
                        try:
                            rname = getattr(ctx.room, 'name', None)
                            if rname:
                                update_history(rname, 'user', text)
                        except:
                            pass
                            # Persist user message if possible
                            try:
                                await persist_user_message_if_possible(ctx, user_role, text, business_id)
                            except Exception:
                                pass
                        
                        # Process the text message through the session with centralized handling
                        try:
                            ok = await safe_generate_reply(session, ctx, text, timeout=30.0)
                            if ok:
                                logger.info(f"Successfully processed text message and generated reply")
                            else:
                                logger.warning(f"Reply generation did not complete for text: {text[:50]}")
                        except Exception as e:
                            logger.exception(f"Failed to generate reply from text: {e}")
            except Exception as e:
                logger.exception(f"Error handling participant data: {e}")
        
        # Listen to room participant data events
        # LiveKit agents receive text via data_received events from participants
        try:
            def on_data_received(*args, **kwargs):
                """Handle data_received event - can be called with different signatures"""
                try:
                    # Handle different event signatures
                    packet = None
                    participant = None
                    topic = None
                    
                    # Try to extract from args/kwargs
                    if args:
                        packet = args[0] if len(args) > 0 else None
                        participant = args[1] if len(args) > 1 else None
                    
                    if kwargs:
                        packet = kwargs.get('packet') or kwargs.get('message') or packet
                        participant = kwargs.get('participant') or participant
                        topic = kwargs.get('topic') or ''
                    
                    # If packet is None, the whole first arg might be the packet
                    if not packet and args:
                        packet = args[0]
                    
                    if packet:
                        # Check topic if available
                        if hasattr(packet, 'topic'):
                            topic = packet.topic or ''
                        
                        # Handle lk.chat topic messages
                        if topic == 'lk.chat' or not topic:
                            asyncio.create_task(_handle_participant_data(packet, participant))
                except Exception as e:
                    logger.debug(f"Error in on_data_received wrapper: {e}")
            
            # Attach listener to room - try multiple event names
            if hasattr(ctx.room, 'on'):
                try:
                    ctx.room.on('data_received', on_data_received)
                    logger.debug('Attached room data_received handler')
                except Exception as e:
                    logger.debug(f"Could not attach room data_received: {e}")
                
                # Also try 'data' event
                try:
                    ctx.room.on('data', on_data_received)
                    logger.debug('Attached room data handler')
                except:
                    pass
                
                # Listen for new participants joining
                async def on_participant_connected(participant):
                    try:
                        if hasattr(participant, 'on'):
                            participant.on('data_received', on_data_received)
                            participant.on('data', on_data_received)
                            logger.debug(f"Attached data handler for new participant: {participant.identity}")
                    except Exception as e:
                        logger.debug(f"Could not attach handler for new participant: {e}")
                
                try:
                    ctx.room.on('participant_connected', on_participant_connected)
                    logger.debug('Attached participant_connected handler')
                except Exception as e:
                    logger.debug(f"Could not attach participant_connected: {e}")
                
            # Also attach to existing remote participants (users sending data to agent)
            # From agent's perspective, users are remote participants
            try:
                if hasattr(ctx.room, 'remote_participants'):
                    participants_dict = ctx.room.remote_participants
                    if hasattr(participants_dict, 'values'):
                        for participant in participants_dict.values():
                            try:
                                if participant and hasattr(participant, 'on'):
                                    participant.on('data_received', on_data_received)
                                    participant.on('data', on_data_received)
                                    logger.debug(f"Attached data handler for existing participant: {getattr(participant, 'identity', 'unknown')}")
                            except Exception as e:
                                logger.debug(f"Could not attach handler for participant: {e}")
                # Also try getting participants another way
                elif hasattr(ctx.room, 'participants'):
                    participants_dict = ctx.room.participants
                    if hasattr(participants_dict, 'values'):
                        for participant in participants_dict.values():
                            try:
                                # Skip the agent itself (local participant)
                                if hasattr(participant, 'identity') and 'agent' not in str(participant.identity).lower():
                                    if hasattr(participant, 'on'):
                                        participant.on('data_received', on_data_received)
                                        participant.on('data', on_data_received)
                                        logger.debug(f"Attached data handler for participant: {participant.identity}")
                            except Exception as e:
                                logger.debug(f"Could not attach handler: {e}")
            except Exception as e:
                logger.debug(f"Could not iterate participants: {e}")
                
            logger.debug('Setup participant data handler for text messages')
        except Exception as e:
            logger.warning(f"Could not attach participant data handler: {e}")
        
        # Also try the old data handler as fallback
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
            if attached:
                logger.debug('Attached fallback data handler')
        except Exception:
            logger.debug('Could not attach fallback data handler')

        # Attach transcription listeners to capture assistant (agent) speech and persist it
        try:
            def on_transcription(event):
                try:
                    # Aggregate text from segments
                    text = ''
                    if hasattr(event, 'segments') and isinstance(event.segments, list):
                        try:
                            text = ' '.join([seg.text for seg in event.segments if getattr(seg, 'text', '')])
                        except Exception:
                            text = ''
                    if not text and hasattr(event, 'text'):
                        text = getattr(event, 'text', '')

                    if not text or not str(text).strip():
                        return

                    # Only persist if the transcription is from the agent (local participant)
                    participant = getattr(event, 'participant', None)
                    local_participant = getattr(ctx.room, 'local_participant', None)
                    if local_participant is not None and participant == local_participant:
                        asyncio.create_task(persist_assistant_message_if_possible(ctx, user_role, text, business_id))
                except Exception:
                    pass

            if hasattr(ctx.room, 'on'):
                try:
                    ctx.room.on('transcription', on_transcription)
                except Exception:
                    pass
                try:
                    ctx.room.on('transcriptionReceived', on_transcription)
                except Exception:
                    pass
        except Exception:
            logger.debug('Could not attach transcription listeners')

        # 8. Setup text input handler via AgentSession (if available)
        # AgentSession may have built-in text handling
        try:
            if hasattr(session, 'on_user_text') or hasattr(session, 'handle_text'):
                logger.debug('AgentSession has built-in text handling')
            
            # Also try to use AgentSession's text message handler if it exists
            if hasattr(session, 'on'):
                try:
                    session.on('user_message', lambda msg: asyncio.create_task(_handle_participant_data(msg.text if hasattr(msg, 'text') else msg, None)))
                    logger.debug('Attached session user_message handler')
                except:
                    pass
        except Exception as e:
            logger.debug(f"Could not setup session text handler: {e}")
        
        # If owner, attempt to fetch owner details from business_context
        owner_info = {}
        if is_owner:
            # Prefer owner info embedded in business_context if present
            if isinstance(business_context, dict):
                owner_info = business_context.get('owner') or business_context.get('ownerInfo') or {}
            else:
                owner_info = {}
            # If owner_info is empty, we'll try metadata or business id below
            # business_context may include owner metadata
            # If owner_info is just an email or id, try to resolve via backend tool
            try:
                # Prefer to resolve full owner profile via tools.get_owner_profile
                from tools import get_owner_profile
                resolved = None
                # If business_context has owner email or id, try that first
                candidate = None
                if isinstance(owner_info, dict):
                    candidate = owner_info.get('email') or owner_info.get('id') or owner_info.get('_id')
                elif isinstance(owner_info, str):
                    candidate = owner_info

                # If we have a candidate (email or id/slug), try resolving
                if candidate:
                    try:
                        res = await get_owner_profile(mock_ctx, candidate)
                        import json as _json
                        if res:
                            try:
                                parsed = _json.loads(res) if isinstance(res, str) else res
                                if isinstance(parsed, dict) and parsed:
                                    resolved = parsed
                                elif isinstance(parsed, list) and parsed:
                                    resolved = parsed[0]
                            except Exception:
                                resolved = None
                    except Exception:
                        resolved = None

                # If resolution succeeded, use it; otherwise keep owner_info as-is
                if resolved:
                    owner_info = resolved
                else:
                    # If owner_info is an email string, normalize to dict
                    if isinstance(owner_info, str) and '@' in owner_info:
                        owner_info = {'email': owner_info}
            except Exception:
                owner_info = owner_info or {}

            # If we still don't have owner_info, try metadata or business_id
            try:
                if (not owner_info or (isinstance(owner_info, dict) and not owner_info.get('email') and not owner_info.get('name'))):
                    md = metadata or {}
                    candidate = None
                    # Common metadata fields used by frontends
                    candidate = md.get('ownerEmail') or md.get('email') or md.get('owner') or None
                    if not candidate and business_id:
                        candidate = business_id
                    if candidate:
                        try:
                            res = await get_owner_profile(mock_ctx, candidate)
                            import json as _json
                            parsed = _json.loads(res) if isinstance(res, str) else res
                            if isinstance(parsed, dict) and parsed:
                                owner_info = parsed
                        except Exception:
                            pass
            except Exception:
                pass

        # 9. Generate initial welcome message (session is now running)
        # Initialize welcome_msg outside try block to ensure it's always defined
        welcome_msg = "Hello! I'm Voxa. How can I help you today?"
        
        try:
            if is_owner:
                owner_name = owner_info.get('name') if isinstance(owner_info, dict) else None
                if not owner_name:
                    # Try to extract from metadata - check userName first (set by backend)
                    try:
                        md = metadata or {}
                        owner_name = md.get('userName') or md.get('ownerName') or md.get('owner') or None
                        if not owner_name and isinstance(md.get('owner'), dict):
                            owner_name = md.get('owner', {}).get('name')
                    except Exception:
                        owner_name = None
                
                # If still no name, try email from metadata
                if not owner_name:
                    try:
                        md = metadata or {}
                        owner_email = md.get('userEmail') or md.get('email') or None
                        if owner_email and isinstance(owner_email, str) and '@' in owner_email:
                            owner_name = owner_email.split('@', 1)[0]
                    except Exception:
                        pass

                if owner_name:
                    welcome_msg = f"Hi {owner_name}! I'm Voxa, your AI business assistant. I can help you manage customers, tickets, analytics, and more. What would you like to focus on today?"
                else:
                    welcome_msg = "Hello! I'm Voxa, your AI business assistant. I can help you manage customers, tickets, analytics, and more. How can I assist you today?"
            elif user_role == 'customer':
                # Customer-facing quick friendly intro using business name if available
                try:
                    biz_name = business_context.get('name') if isinstance(business_context, dict) else None
                except Exception:
                    biz_name = None
                if biz_name:
                    welcome_msg = f"Hi there! I'm Voxa, your AI assistant for {biz_name}. I'm here to help — can I get your name to get started?"
                else:
                    welcome_msg = "Hi there! I'm Voxa, your AI assistant. I'm here to help — can I get your name to get started?"

            else:
                # General users (public) - try to greet by provided metadata name/email
                try:
                    md = metadata or {}
                    gen_name = md.get('userName') or md.get('name') or None
                    gen_email = md.get('userEmail') or md.get('email') or None
                    
                    # If name not in metadata, try to fetch from backend using email
                    if not gen_name and gen_email:
                        try:
                            # Try to fetch general user profile from backend
                            import requests as _req
                            backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
                            api_key = os.getenv('BACKEND_API_KEY', '')
                            headers = {}
                            if api_key:
                                headers["Authorization"] = f"Bearer {api_key}"
                            
                            # Try to get general user by email (URL encode the email)
                            try:
                                import urllib.parse
                                encoded_email = urllib.parse.quote(gen_email, safe='')
                                gen_user_resp = _req.get(
                                    f"{backend_url}/api/auth/general/user/{encoded_email}",
                                    headers=headers,
                                    timeout=5
                                )
                                if gen_user_resp.status_code == 200:
                                    gen_user_data = gen_user_resp.json()
                                    if gen_user_data.get('name'):
                                        gen_name = gen_user_data.get('name')
                                        logger.debug(f"Fetched general user name from backend: {gen_name}")
                            except Exception as e:
                                logger.debug(f"Failed to fetch general user by email: {e}")
                        except Exception:
                            pass
                except Exception:
                    gen_name = None
                    gen_email = None

                if gen_name:
                    welcome_msg = f"Hi {gen_name}! I'm Voxa. I can help with info, support, and more. What would you like help with today?"
                elif gen_email:
                    try:
                        local = gen_email.split('@', 1)[0]
                        if local:
                            welcome_msg = f"Hi {local}! I'm Voxa. I can help with info, support, and more. What would you like help with today?"
                        else:
                            welcome_msg = "Hey! I'm Voxa. I can help with info, support, and more. What's your name?"
                    except Exception:
                        welcome_msg = "Hey! I'm Voxa. I can help with info, support, and more. What's your name?"
                else:
                    welcome_msg = "Hey! I'm Voxa. I can help with info, support, and more. What's your name?"
            
            logger.info(f"Generated welcome message for {user_role}: {welcome_msg[:100]}...")
            
            # Wait for at least one participant to connect before sending welcome
            # This ensures the user is actually connected and can receive the message
            max_wait = 10  # Maximum wait time in seconds
            wait_interval = 0.5  # Check every 0.5 seconds
            waited = 0
            participants_connected = False
            
            while waited < max_wait:
                try:
                    # Check if there are any remote participants (users) connected
                    if hasattr(ctx.room, 'remote_participants'):
                        remote_parts = getattr(ctx.room, 'remote_participants', {})
                        if isinstance(remote_parts, dict) and len(remote_parts) > 0:
                            participants_connected = True
                            logger.debug(f"Found {len(remote_parts)} remote participant(s)")
                            break
                        elif hasattr(remote_parts, '__len__') and len(remote_parts) > 0:
                            participants_connected = True
                            logger.debug("Found remote participants (via __len__)")
                            break
                    # Also check participants attribute
                    if hasattr(ctx.room, 'participants'):
                        parts = getattr(ctx.room, 'participants', {})
                        if isinstance(parts, dict):
                            # Exclude local participant (agent)
                            remote_count = len([p for p in parts.values() if hasattr(p, 'identity') and 'agent' not in str(p.identity).lower()])
                            if remote_count > 0:
                                participants_connected = True
                                logger.debug(f"Found {remote_count} participant(s) via participants attribute")
                                break
                except Exception as e:
                    logger.debug(f"Error checking participants: {e}")
                
                await asyncio.sleep(wait_interval)
                waited += wait_interval
            
            if not participants_connected:
                logger.warning("No participants connected after waiting, sending welcome message anyway")
            
            # Use centralized safe generator for welcome message
            try:
                ok = await safe_generate_reply(session, ctx, welcome_msg, timeout=30.0)
                if ok:
                    logger.info("Welcome message sent via voice successfully")
                else:
                    logger.warning("Initial welcome message did not complete")
            except Exception as e:
                logger.warning(f"Welcome message generation error: {e}")
        except Exception as e:
            logger.exception(f'Failed to generate initial reply: {e}')
            # welcome_msg is already initialized above, so it will always have a value

        # Publish the plain welcome text into the LiveKit data channel so
        # frontends listening with AgentChatListener receive it as an
        # immediate chat message. This is best-effort and won't fail the
        # agent if publishing fails.
        # IMPORTANT: Always try to publish the welcome message, even if voice generation failed
        try:
            import json as _json
            payload_data = { 'type': 'agent_response', 'text': welcome_msg }
            payload_json = _json.dumps(payload_data)
            payload_bytes = payload_json.encode('utf-8')
            
            if hasattr(ctx.room, 'local_participant') and getattr(ctx.room, 'local_participant'):
                local_participant = ctx.room.local_participant
                try:
                    # Try publish_data first (standard LiveKit method)
                    if hasattr(local_participant, 'publish_data'):
                        await local_participant.publish_data(payload_bytes, reliable=True)
                        logger.info(f"Published welcome message via publish_data: {welcome_msg[:50]}...")
                    # Try sendText if available (some LiveKit versions)
                    elif hasattr(local_participant, 'sendText'):
                        await local_participant.sendText(welcome_msg, topic='lk.chat')
                        logger.info(f"Published welcome message via sendText: {welcome_msg[:50]}...")
                    else:
                        logger.warning("Local participant has no publish_data or sendText method")
                except Exception as e:
                    logger.warning(f"Could not publish welcome message via local_participant: {e}")
                    # Try alternative: send via room data API if available
                    try:
                        if hasattr(ctx.room, 'send_data'):
                            await ctx.room.send_data(payload_bytes, reliable=True)
                            logger.info(f"Published welcome message via room.send_data: {welcome_msg[:50]}...")
                    except Exception as e2:
                        logger.debug(f"Could not publish via room.send_data either: {e2}")
            else:
                logger.warning("No local_participant available to publish welcome message")
        except Exception as e:
            logger.warning(f"Exception publishing welcome message: {e}")

        # 10. For customers, fetch business context at start
        if user_role == 'customer' and business_id:
            try:
                # Business context already fetched above, but ensure it's available for tools
                logger.debug(f"Customer connected for business {business_id}")
            except Exception:
                logger.exception('Failed to prepare customer context')

        # 11. Collect customer info if needed (customers) and register general users
        if user_role == 'customer' and business_id:
            try:
                cust = await collect_customer_info_if_needed(session, ctx, ctx.room.name, business_id)
                
                # After collecting customer info, automatically create a support ticket
                try:
                    from tools import create_ticket
                    ticket_result = await create_ticket(
                        ctx,
                        title="Customer Support Request",
                        description=f"Support request initiated by {cust.get('name', 'Customer')} via voice chat",
                        priority="medium",
                        customer_email=cust.get('email'),
                        business_id=business_id,
                        customer_name=cust.get('name'),
                        customer_phone=cust.get('phone')
                    )
                    logger.debug(f"Ticket created: {ticket_result}")
                    
                    # Thank the customer and let them know a ticket was created
                    try:
                        await safe_generate_reply(session, ctx, f"Thank you {cust.get('name')}! I've collected your information and created a support ticket. How can I help you today?", timeout=30.0)
                    except Exception as e:
                        logger.warning(f"Could not generate thank you message: {e}")
                        # Don't fail the whole flow if reply generation fails
                except Exception as e:
                    logger.exception(f"Failed to create ticket after collecting customer info: {e}")
                    # Still thank the customer even if ticket creation fails
                    try:
                        await safe_generate_reply(session, ctx, f"Thank you {cust.get('name')}, I have your info. How can I help you today?", timeout=30.0)
                    except Exception as reply_err:
                        logger.warning(f"Could not generate thank you message: {reply_err}")
            except Exception:
                logger.exception('Failed to collect customer info')
        elif user_role == 'general':
            # Lightweight identity collection for general users: name, email, location
            try:
                hist = get_room_history(ctx.room.name)
                needed = {'name': None, 'email': None, 'location': None}
                # Try metadata first
                md = getattr(ctx.room, 'metadata', {}) if hasattr(ctx.room, 'metadata') else {}
                if isinstance(md, str):
                    try:
                        import json as _json
                        md = _json.loads(md)
                    except Exception:
                        md = {}
                if isinstance(md, dict):
                    for k in needed:
                        needed[k] = needed[k] or md.get(k)

                async def ask(prompt_text: str, validate_fn):
                    try:
                        await safe_generate_reply(session, ctx, prompt_text, timeout=30.0)
                    except Exception:
                        pass
                    # Wait for user response
                    tries = 0
                    while tries < 30:
                        await asyncio.sleep(0.5)
                        new_hist = get_room_history(ctx.room.name)
                        if len(new_hist) > len(hist):
                            reply = new_hist[-1]['content']
                            if validate_fn(reply):
                                return reply
                        tries += 1
                    return None

                if not needed['name']:
                    needed['name'] = await ask("To get acquainted, what's your name?", lambda v: isinstance(v, str) and len(v.strip()) > 1)
                if not needed['email']:
                    needed['email'] = await ask("What's your email? I'll use it to keep context between chats.", lambda v: isinstance(v, str) and '@' in v and '.' in v)
                if not needed['location']:
                    needed['location'] = await ask("And where are you located? (city, country)", lambda v: isinstance(v, str) and len(v.strip()) > 1)

                # Register general user in backend (idempotent)
                try:
                    import requests as _req
                    backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
                    _req.post(f"{backend_url}/api/auth/general/register", json={
                        'name': needed['name'] or 'Guest',
                        'email': needed['email'] or 'unknown@example.com',
                        'location': needed['location'] or 'unknown',
                    }, timeout=10)
                except Exception:
                    pass
                # Cache identity for future persistence
                try:
                    rname = getattr(ctx.room, 'name', None)
                    if rname:
                        room_user_identity[rname] = {
                            'role': 'general',
                            'email': needed['email'] or None
                        }
                except Exception:
                    pass
            except Exception:
                logger.debug('general user onboarding failed')

       
        # This allows the agent to stay alive for multiple connection cycles
        try:
            # Keep the entrypoint running until room closes
            await asyncio.sleep(0.1)  # Small sleep to allow event loop processing
        except asyncio.CancelledError:
            logger.debug("Entrypoint cancelled")
        
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