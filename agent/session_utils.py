import logging
from livekit.agents import AgentSession

logger = logging.getLogger(__name__)

async def safe_generate_reply(session: AgentSession, ctx, instructions: str, timeout: float = 30.0, publish_back: bool = True) -> bool:
    """Robust wrapper around session.generate_reply with timeout and UX data-channel errors."""
    try:
        import asyncio as _asyncio
        try:
            await _asyncio.wait_for(session.generate_reply(instructions=instructions), timeout=timeout)
            return True
        except _asyncio.TimeoutError as te:
            logger.warning(f"generate_reply timed out waiting for response: {te}")
            try:
                if publish_back and hasattr(ctx, 'room') and getattr(ctx.room, 'local_participant', None):
                    try:
                        import json as _json
                        payload = _json.dumps({'type': 'agent_error', 'message': 'Reply generation timed out. Please try again.'})
                        await ctx.room.local_participant.publish_data(payload.encode('utf-8'), reliable=True)
                    except Exception:
                        pass
            except Exception:
                pass
            return False
        except Exception as e:
            msg = str(e)
            logger.exception(f"Error while generating reply: {msg}")
            try:
                if publish_back and hasattr(ctx, 'room') and getattr(ctx.room, 'local_participant', None):
                    try:
                        import json as _json
                        payload = _json.dumps({'type': 'agent_error', 'message': 'Agent failed to generate reply. Please try again later.'})
                        await ctx.room.local_participant.publish_data(payload.encode('utf-8'), reliable=True)
                    except Exception:
                        pass
            except Exception:
                pass
            return False
    except Exception as outer:
        logger.exception(f"safe_generate_reply unexpected error: {outer}")
        return False


