import os
import logging

logger = logging.getLogger(__name__)

# In-memory history per room
conversation_histories: dict = {}
HISTORY_LIMIT = 10
room_user_identity: dict = {}

# Optional Redis backend
try:
    import redis as _redis
    _redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
    try:
        redis_client = _redis.from_url(_redis_url)
    except Exception:
        redis_client = _redis.StrictRedis.from_url(_redis_url)
except Exception:
    redis_client = None


def get_room_history(room_name: str):
    if room_name not in conversation_histories:
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
    hist = get_room_history(room_name)
    hist.append({"role": role, "content": content})
    if len(hist) > HISTORY_LIMIT:
        hist.pop(0)
    if redis_client:
        try:
            import json as _json
            redis_client.set(f"voxa:history:{room_name}", _json.dumps(hist))
        except Exception:
            logger.debug('Failed to persist room history to Redis')


async def persist_user_message_if_possible(ctx, user_role: str, text: str, business_id: str):
    """Persist user messages for customers/general users when we can identify by email."""
    try:
        room = getattr(ctx, 'room', None)
        rname = getattr(room, 'name', None) if room is not None else None
        identity = room_user_identity.get(rname, {}) if rname else {}

        metadata = getattr(room, 'metadata', {}) if hasattr(room, 'metadata') else {}
        if isinstance(metadata, str):
            try:
                import json as _json
                metadata = _json.loads(metadata)
            except Exception:
                metadata = {}
        email = identity.get('email') or (metadata.get('email') if isinstance(metadata, dict) else None)

        if not email or not isinstance(email, str) or '@' not in email:
            return

        import requests as _req
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        payload = { 'role': 'user', 'content': text }

        if user_role == 'customer' and business_id:
            try:
                _req.post(f"{backend_url}/api/crm/customers/email/{email}/conversations", params={'businessId': business_id}, json=payload, timeout=6)
            except Exception:
                pass
        elif user_role == 'general':
            try:
                _req.post(f"{backend_url}/api/general/users/email/{email}/conversations", json=payload, timeout=6)
            except Exception:
                pass
    except Exception:
        logger.debug('persist_assistant_message_if_possible failed')


async def persist_assistant_message_if_possible(ctx, user_role: str, text: str, business_id: str):
    """Persist assistant (agent) messages to DB for customers and general users."""
    try:
        room = getattr(ctx, 'room', None)
        rname = getattr(room, 'name', None) if room is not None else None
        identity = room_user_identity.get(rname, {}) if rname else {}

        metadata = getattr(room, 'metadata', {}) if hasattr(room, 'metadata') else {}
        if isinstance(metadata, str):
            try:
                import json as _json
                metadata = _json.loads(metadata)
            except Exception:
                metadata = {}
        email = identity.get('email') or (metadata.get('email') if isinstance(metadata, dict) else None)

        if not email or not isinstance(email, str) or '@' not in email:
            return

        import requests as _req
        backend_url = os.getenv("BACKEND_URL", "https://voxa-smoky.vercel.app")
        payload = { 'role': 'assistant', 'content': text }

        if user_role == 'customer' and business_id:
            try:
                _req.post(f"{backend_url}/api/crm/customers/email/{email}/conversations", params={'businessId': business_id}, json=payload, timeout=6)
            except Exception:
                pass
        elif user_role == 'general':
            try:
                _req.post(f"{backend_url}/api/general/users/email/{email}/conversations", json=payload, timeout=6)
            except Exception:
                pass
    except Exception:
        logger.debug('persist_assistant_message_if_possible failed')


