# Multi-Customer Agent Support - Architecture & Implementation

## Overview: Three Use Cases

This guide covers implementing LiveKit agents that can serve multiple users concurrently across three different scenarios:

1. **Case 1:** Business Manager AI - Serves multiple business owners across different businesses
2. **Case 2:** Customer Care AI - Each business has multiple customers needing individual attention
3. **Case 3:** General AI Assistant - Universal assistant not tied to any business

## Problem: Current Single-Room Architecture

### What Happens Now (Broken)
```
Customer 1 → business-123 (same room)
Customer 2 → business-123 (same room) ❌ Everyone hears each other!
Customer 3 → business-123 (same room)
        ↓
    One Agent (confused, trying to respond to everyone)
```

**Issues:**
- All customers in same room = conference call chaos
- No privacy between customer conversations
- Agent can't track individual contexts
- Not scalable for customer support

## Solution: One Room Per Session

### How LiveKit Works

**Key Principle:** LiveKit automatically creates rooms and dispatches agents when users connect. Each room gets its own isolated agent process.

**Automatic Dispatch:**
- When a user connects to a non-existent room, LiveKit creates it automatically
- LiveKit server selects an available worker and dispatches a job
- The worker instantiates your agent and joins that specific room
- Each agent runs in its own process for complete isolation

### Correct Architecture for All Three Cases

```
Case 1: Business Owners
Owner 1 → owner-business-123 → Agent 1
Owner 2 → owner-business-456 → Agent 2
Owner 3 → owner-business-789 → Agent 3

Case 2: Customer Care (Per Business)
Business A Customer 1 → business-123-session-abc → Agent 1
Business A Customer 2 → business-123-session-def → Agent 2
Business B Customer 1 → business-456-session-xyz → Agent 3
Business B Customer 2 → business-456-session-ghi → Agent 4

Case 3: General Assistant
User 1 → general-session-timestamp-uuid1 → Agent 1
User 2 → general-session-timestamp-uuid2 → Agent 2
User 3 → general-session-timestamp-uuid3 → Agent 3
```

**Benefits:**
- ✅ Complete privacy per session
- ✅ Each agent maintains individual context
- ✅ Scalable to thousands of concurrent users
- ✅ Automatic load balancing by LiveKit
- ✅ Process isolation prevents crashes from affecting other sessions

## Implementation

### 1. Frontend Changes (CustomerChat.tsx)

**Updated Code with Session Management:**

```typescript
import { useState, useEffect } from "react";
import { getLivekitToken } from "@/lib/api.ts";

const CustomerChat = ({ role }: { role?: 'customer' | 'owner' | 'general' }) => {
  const { slug = "" } = useParams();
  const [businessId, setBusinessId] = useState<string>("");
  const [livekitInfo, setLivekitInfo] = useState<{ token: string; serverUrl: string } | null>(null);
  
  // Determine effective role
  const effectiveRole: 'customer' | 'owner' | 'general' = (() => {
    if (role) return role;
    try {
      if (localStorage.getItem('voxa_token')) return 'owner';
      if (localStorage.getItem('voxa_general_token')) return 'general';
    } catch (e) { }
    return 'customer';
  })();

  // Generate unique session ID per user
  const generateSessionId = () => {
    return `${Date.now()}-${crypto.randomUUID()}`;
  };

  // Get or create session ID (persists for reconnection)
  const getOrCreateSessionId = () => {
    try {
      let sessionId = sessionStorage.getItem('voxa_session_id');
      if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem('voxa_session_id', sessionId);
      }
      return sessionId;
    } catch {
      return generateSessionId();
    }
  };

  const handleStartCall = async () => {
    setIsConnecting(true);
    try {
      // Fetch fresh user details from database
      let userName: string | undefined = undefined;
      let userEmail: string | undefined = undefined;
      
      if (effectiveRole === 'owner') {
        if (businessId) {
          try {
            const ownerData = await getOwnerByBusinessId(businessId);
            if (ownerData) {
              userName = ownerData.name || undefined;
              userEmail = ownerData.email || undefined;
            }
          } catch (err) {
            // Fallback to localStorage
            const ou = localStorage.getItem('voxa_user');
            if (ou) {
              try {
                const parsed = JSON.parse(ou);
                userName = parsed?.name || undefined;
                userEmail = parsed?.email || undefined;
              } catch (_) {}
            }
          }
        }
      } else if (effectiveRole === 'general') {
        const gu = localStorage.getItem('voxa_general_user');
        let emailToFetch: string | undefined = undefined;
        
        if (gu) {
          try {
            const parsed = JSON.parse(gu);
            emailToFetch = parsed?.email || undefined;
            userName = parsed?.name || undefined;
          } catch (_) {}
        }
        
        if (emailToFetch) {
          try {
            const generalUserData = await getGeneralUserByEmail(emailToFetch);
            if (generalUserData) {
              userName = generalUserData.name || userName;
              userEmail = generalUserData.email || emailToFetch;
            }
          } catch (err) {
            console.warn('[CustomerChat] Failed to fetch general user from DB:', err);
          }
        }
      } else if (effectiveRole === 'customer') {
        let emailToFetch: string | undefined = undefined;
        
        if (pendingCustomerInfo.email) {
          emailToFetch = pendingCustomerInfo.email;
          userName = pendingCustomerInfo.name || userName;
        } else {
          try {
            const storedCustomer = sessionStorage.getItem('customerData');
            if (storedCustomer) {
              const parsed = JSON.parse(storedCustomer);
              emailToFetch = parsed?.email || undefined;
              userName = parsed?.name || userName;
            }
          } catch (_) {}
        }
        
        if (emailToFetch && businessId) {
          try {
            const customerData = await getCustomerByEmail(emailToFetch, businessId);
            if (customerData) {
              userName = customerData.name || userName;
              userEmail = customerData.email || emailToFetch;
              if (customerData._id || customerData.id) {
                setCustomerId(customerData._id || customerData.id || null);
                sessionStorage.setItem('customerId', customerData._id || customerData.id || '');
              }
            }
          } catch (err) {
            console.warn('[CustomerChat] Failed to fetch customer from DB:', err);
          }
        }
      }

      // Generate unique session ID for this connection
      const sessionId = getOrCreateSessionId();
      
      // Prepare metadata for agent
      const metadata = {
        userRole: effectiveRole,
        businessId: businessId || 'general',
        userName: userName || 'Guest',
        userEmail: userEmail || '',
        sessionId: sessionId,
        timestamp: Date.now()
      };

      // Get LiveKit token with session info
      const info = await getLivekitToken({
        role: effectiveRole,
        businessId: businessId || 'general',
        userName,
        userEmail,
        sessionId, // This creates unique room per session
        metadata
      });
      
      // Clear any stale state
      setLivekitInfo(null);
      setIsCallActive(false);
      
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set new token and activate call
      setLivekitInfo(info);
      setIsCallActive(true);
      setErrorBanner("");
      
      try { 
        localStorage.setItem('voxa_last_session', JSON.stringify({ 
          role: effectiveRole, 
          businessId,
          sessionId 
        })); 
      } catch {}
      
    } catch (e) {
      console.error('Failed to start call:', e);
      setIsCallActive(false);
      setLivekitInfo(null);
      setErrorBanner('Could not start the call. Check your connection and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Rest of your component...
};
```

### 2. Backend Changes (Token Generation)

**File: `api.ts` or your token generation endpoint**

```typescript
import { AccessToken } from 'livekit-server-sdk';

export async function getLivekitToken({ 
  role, 
  businessId, 
  userName, 
  userEmail,
  sessionId,
  metadata 
}: { 
  role: string; 
  businessId: string; 
  userName?: string; 
  userEmail?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;
  
  if (!apiKey || !apiSecret || !serverUrl) {
    throw new Error('LiveKit credentials not configured');
  }
  
  // Create unique room name based on role and session
  let roomName: string;
  
  if (role === 'owner') {
    // Owners get a business-specific room (can have multiple owners per business if needed)
    // For true isolation per owner, use: `owner-${businessId}-${userEmail}`
    roomName = `owner-${businessId}`;
  } else if (role === 'general') {
    // General users get unique session rooms (not tied to business)
    roomName = `general-session-${sessionId || Date.now()}`;
  } else {
    // Customers get unique session rooms per business
    roomName = `${businessId}-session-${sessionId || Date.now()}`;
  }
  
  // Create unique identity for this participant
  const identity = `${role}-${userEmail || Date.now()}`;
  
  // Create access token with participant attributes
  const at = new AccessToken(apiKey, apiSecret, {
    identity: identity,
    name: userName || 'Guest',
    // These attributes are accessible by the agent
    attributes: {
      role: metadata?.userRole || role,
      businessId: metadata?.businessId || businessId,
      userName: metadata?.userName || userName || 'Guest',
      userEmail: metadata?.userEmail || userEmail || '',
      sessionId: sessionId || '',
      timestamp: metadata?.timestamp || Date.now().toString(),
    },
  });
  
  // Grant permissions for the specific room
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true, // For text messages
  });
  
  const token = await at.toJwt();
  
  return {
    token,
    serverUrl,
    roomName // Useful for debugging
  };
}
```

### 3. Agent Worker (Simplified with Auto-Dispatch)

**File: `agent.py` - Python Agent Worker**

```python
import logging
from livekit.agents import JobContext, JobRequest, WorkerOptions, cli
from livekit.agents.llm import ChatContext
from livekit.plugins import openai, silero

logger = logging.getLogger("voxa-agent")

# Define instructions for different roles
def get_instructions_for_role(role: str, user_name: str, business_id: str) -> str:
    """Generate role-specific instructions for the agent"""
    
    if role == 'owner':
        return f"""You are Voxa, an AI business management assistant.

You're speaking with {user_name}, a business owner.
Business ID: {business_id}

Your responsibilities:
- Greet them professionally by name
- Help with business operations and analytics
- Review and manage support tickets
- Provide strategic business insights
- Access business data when needed
- Be efficient, professional, and solution-oriented

Always be proactive in offering relevant business insights."""

    elif role == 'general':
        return f"""You are Voxa, a general AI assistant.

You're speaking with {user_name}.

Your responsibilities:
- Greet them warmly by name
- Provide helpful, accurate information
- Assist with general questions and tasks
- Be friendly, patient, and conversational
- Adapt to their needs

You're not tied to any specific business - you're a universal helper."""

    else:  # customer
        return f"""You are Voxa, a customer support AI assistant.

You're speaking with {user_name}, a customer.
Business ID: {business_id}

Your responsibilities:
- Greet them warmly by name
- Ask how you can help today
- Listen carefully to their concerns
- Provide accurate support information
- Create support tickets when needed
- Be empathetic, patient, and solution-focused
- Follow up on their issues

Always prioritize customer satisfaction."""


async def entrypoint(ctx: JobContext):
    """
    Main agent entrypoint - automatically dispatched by LiveKit for each new room.
    
    LiveKit handles:
    - Room creation when user connects
    - Worker selection and load balancing
    - Process isolation per session
    - Automatic scaling
    
    You just need to:
    - Connect to the room
    - Read participant metadata
    - Configure agent for that specific user
    """
    
    # Connect to the room
    await ctx.connect()
    
    logger.info(f"[Agent] Connected to room: {ctx.room.name}")
    
    # Wait for the participant to join (the user who triggered this agent)
    participant = await ctx.wait_for_participant()
    
    # Extract user information from participant attributes
    user_role = participant.attributes.get('role', 'customer')
    user_name = participant.attributes.get('userName', 'Guest')
    user_email = participant.attributes.get('userEmail', '')
    business_id = participant.attributes.get('businessId', '')
    session_id = participant.attributes.get('sessionId', '')
    
    logger.info(f"[Agent] Session started - Role: {user_role}, User: {user_name}, Session: {session_id}")
    
    # Generate role-specific instructions
    instructions = get_instructions_for_role(user_role, user_name, business_id)
    
    # Initialize chat context with instructions
    chat_ctx = ChatContext()
    chat_ctx.append(
        role="system",
        text=instructions
    )
    
    # Create the agent with OpenAI LLM and voice capabilities
    assistant = openai.realtime.RealtimeModel(
        instructions=instructions,
        voice="alloy",  # Choose voice: alloy, echo, fable, onyx, nova, shimmer
        temperature=0.8,
        modalities=["audio", "text"],
    )
    
    # Start the agent session
    agent = assistant.create_agent(room=ctx.room)
    
    # Start listening and responding
    await agent.start()
    
    # Generate personalized greeting based on role
    if user_role == 'owner':
        greeting = f"Hello {user_name}! I'm Voxa, your business assistant. How can I help you manage your business today?"
    elif user_role == 'general':
        greeting = f"Hi {user_name}! I'm Voxa, your AI assistant. What can I help you with today?"
    else:  # customer
        greeting = f"Hello {user_name}! Welcome to customer support. I'm Voxa, and I'm here to help. What brings you in today?"
    
    await agent.say(greeting)
    
    logger.info(f"[Agent] Session active for {user_name} ({user_role})")


# Worker configuration - LiveKit auto-handles dispatch
if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            # Optional: Customize worker behavior
            # num_idle_processes=3,  # Keep processes ready for fast dispatch
            # max_retry=3,           # Retry failed jobs
            # request_fnc=None,      # Custom dispatch logic (if needed)
        )
    )
```

### 4. Optional: Custom Dispatch Logic

If you need fine-grained control over which agents handle which rooms:

```python
async def request_fnc(req: JobRequest) -> None:
    """
    Optional: Custom dispatch logic to accept/reject jobs.
    By default, workers accept all jobs - use this for advanced filtering.
    """
    
    # Extract room name to determine job type
    room_name = req.room.name
    
    # Example: Only handle customer sessions
    if room_name.startswith('general-'):
        # Reject general user sessions (let another worker handle them)
        await req.reject()
        return
    
    # Example: Load balancing based on business
    # You could have dedicated workers per business for isolation
    business_id = room_name.split('-')[0]
    
    # Accept this job
    await req.accept(entrypoint)


# Use custom dispatch
if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,  # Enable custom dispatch
        )
    )
```

## Scalability & Performance

### LiveKit Auto-Scaling Features

1. **Automatic Dispatch**: Workers automatically exchange availability with LiveKit server for load balancing
2. **Process Isolation**: Each session runs in a separate process - crashes don't affect others
3. **Horizontal Scaling**: Add more workers to handle increased load
4. **Connection Performance**: Supports hundreds of thousands of connections per second with <150ms dispatch time

### Practical Limits by Use Case

| Use Case | Concurrent Users | Room Pattern | Notes |
|----------|------------------|--------------|-------|
| **Business Owners** | Hundreds | `owner-${businessId}` | One room per business or per owner |
| **Customers** | Thousands+ | `${businessId}-session-${sessionId}` | Unlimited rooms, auto-scaled |
| **General Users** | Thousands+ | `general-session-${sessionId}` | Unlimited rooms, auto-scaled |

### Infrastructure Requirements

**Free/Build Plan:**
- ~10-50 concurrent sessions
- Agents may shut down after all sessions end (10-20s cold start)
- Good for development and testing

**Paid Plans:**
- Up to 100,000 simultaneous participants per session
- Persistent workers (no cold starts)
- Horizontal scaling across multiple nodes
- Production-ready

### Cost Considerations

**Per-minute pricing model:**
- Each customer session = separate agent instance
- Example: 10 customers × 10 minutes each = 100 agent-minutes
- Scale by adding workers, not by modifying code

## Session Management Best Practices

### 1. Session Persistence for Reconnection

```typescript
// Allow users to reconnect to their session
const getOrCreateSessionId = () => {
  try {
    // Check for existing session (allows reconnection)
    let sessionId = sessionStorage.getItem('voxa_session_id');
    
    // Check if session is still valid (optional: add expiry)
    const sessionTimestamp = sessionStorage.getItem('voxa_session_timestamp');
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    if (sessionId && sessionTimestamp) {
      const elapsed = now - parseInt(sessionTimestamp);
      if (elapsed < thirtyMinutes) {
        // Session still valid, reuse it
        return sessionId;
      }
    }
    
    // Create new session
    sessionId = `${Date.now()}-${crypto.randomUUID()}`;
    sessionStorage.setItem('voxa_session_id', sessionId);
    sessionStorage.setItem('voxa_session_timestamp', now.toString());
    
    return sessionId;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};
```

### 2. Session Cleanup in Agent

```python
@ctx.room.on("participant_disconnected")
async def on_disconnect(participant):
    """Handle session cleanup when user disconnects"""
    
    session_id = participant.attributes.get('sessionId')
    user_email = participant.attributes.get('userEmail')
    
    logger.info(f"[Agent] Session ended: {session_id} - User: {user_email}")
    
    # Optional: Save conversation transcript to database
    # await save_transcript(session_id, conversation_history)
    
    # Optional: Trigger follow-up actions
    # await send_summary_email(user_email, session_id)
```

### 3. Graceful Reconnection Handling

```typescript
const handleReconnect = async () => {
  try {
    // Reuse existing session ID
    const existingSessionId = sessionStorage.getItem('voxa_session_id');
    
    if (existingSessionId) {
      // Reconnect to same room
      const info = await getLivekitToken({
        role: effectiveRole,
        businessId,
        userName,
        userEmail,
        sessionId: existingSessionId, // Same session
        metadata: { /* ... */ }
      });
      
      setLivekitInfo(info);
      setIsCallActive(true);
    } else {
      // Start new session
      handleStartCall();
    }
  } catch (err) {
    console.error('Reconnection failed:', err);
    // Clear stale session and start fresh
    sessionStorage.removeItem('voxa_session_id');
    handleStartCall();
  }
};
```

## Testing Multi-User Setup

### Local Testing Script

```bash
#!/bin/bash
# test-concurrent-users.sh

echo "Starting multi-user test..."
echo ""

# Terminal 1: Start agent worker
echo "1. Start agent worker:"
echo "   python agent.py"
echo ""

# Terminal 2-5: Simulate different users
echo "2. Open these URLs in different browsers/incognito:"
echo ""
echo "   Case 1 - Business Owner:"
echo "   http://localhost:5173/chat/business-a (logged in as owner)"
echo ""
echo "   Case 2 - Customers:"
echo "   http://localhost:5173/chat/business-a (Browser 1 - incognito)"
echo "   http://localhost:5173/chat/business-a (Browser 2 - incognito)"
echo "   http://localhost:5173/chat/business-b (Browser 3 - incognito)"
echo ""
echo "   Case 3 - General User:"
echo "   http://localhost:5173/general-chat (Browser 4)"
echo ""

# Verify isolation
echo "3. Each user should see:"
echo "   ✅ Unique session ID in sessionStorage"
echo "   ✅ Personal greeting with their name"
echo "   ✅ Private conversation (can't hear others)"
echo "   ✅ Role-specific agent behavior"
```

### Verification Checklist

```python
# In agent worker, add debugging logs
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    
    # Log room details
    logger.info(f"Room: {ctx.room.name}")
    logger.info(f"Participants: {len(ctx.room.remote_participants)}")
    
    # Should see: 1 participant per room for customer/general
    # Could see: multiple participants for owner room (if business has multiple owners)
    
    participant = await ctx.wait_for_participant()
    
    # Verify unique session
    session_id = participant.attributes.get('sessionId')
    logger.info(f"✅ Unique Session: {session_id}")
    
    # Rest of agent logic...
```

### Expected Behavior

**✅ Correct (Isolated Sessions):**
```
[Agent] Room: business-123-session-abc123
[Agent] Participants: 1
[Agent] ✅ Unique Session: abc123
[Agent] User: John (customer)

[Agent] Room: business-123-session-def456
[Agent] Participants: 1
[Agent] ✅ Unique Session: def456
[Agent] User: Jane (customer)
```

**❌ Wrong (Shared Room - DO NOT DO THIS):**
```
[Agent] Room: business-123
[Agent] Participants: 3 ⚠️ TOO MANY!
[Agent] Users: John, Jane, Bob (all hearing each other!)
```

## Architecture Comparison

### ❌ Wrong: Shared Room
```
┌─────────────────────────────────────┐
│   Room: business-123                │
│                                     │
│   Customer 1 ──┐                   │
│   Customer 2 ──┼─→ One Agent       │
│   Customer 3 ──┘    (Confused!)    │
│                                     │
│   Everyone hears everyone! 🔊       │
└─────────────────────────────────────┘
```

### ✅ Correct: Isolated Sessions (All Cases)
```
Case 1: Business Owners
┌──────────────────────────────┐
│ Room: owner-business-123     │
│ Owner A ↔ Agent 1            │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Room: owner-business-456     │
│ Owner B ↔ Agent 2            │
└──────────────────────────────┘

Case 2: Customers (Per Business)
┌──────────────────────────────┐
│ Room: business-123-session-1 │
│ Customer 1 ↔ Agent 1         │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Room: business-123-session-2 │
│ Customer 2 ↔ Agent 2         │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Room: business-456-session-1 │
│ Customer 3 ↔ Agent 3         │
└──────────────────────────────┘

Case 3: General Users
┌──────────────────────────────┐
│ Room: general-session-xyz    │
│ User 1 ↔ Agent 1             │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Room: general-session-abc    │
│ User 2 ↔ Agent 2             │
└──────────────────────────────┘
```

## Advanced: Load Balancing & Optimization

### 1. Dedicated Workers Per Business (Optional)

For high-traffic businesses, dedicate workers to specific businesses:

```python
# worker-business-123.py
async def request_fnc(req: JobRequest) -> None:
    """Only handle rooms for business-123"""
    room_name = req.room.name
    
    if not room_name.startswith('business-123'):
        await req.reject()  # Let other workers handle it
        return
    
    await req.accept(entrypoint)

cli.run_app(WorkerOptions(
    entrypoint_fnc=entrypoint,
    request_fnc=request_fnc
))
```

### 2. Worker Pool Strategy

```bash
# Deploy multiple workers for different roles
python agent.py --name=customer-worker-1  # Handles customer sessions
python agent.py --name=customer-worker-2  # Handles customer sessions
python agent.py --name=owner-worker       # Handles owner sessions
python agent.py --name=general-worker     # Handles general sessions
```

### 3. Monitor Worker Load

```python
# Add load monitoring
from livekit.agents import WorkerOptions

cli.run_app(
    WorkerOptions(
        entrypoint_fnc=entrypoint,
        num_idle_processes=3,      # Keep 3 processes ready
        max_retry=3,                # Retry failed jobs
        worker_type="room",         # One worker per room
        # Custom load thresholds
        load_threshold=0.8,         # Reject jobs if load > 80%
    )
)
```

## Troubleshooting

### Issue 1: Users Hearing Each Other

**Symptom:** Multiple users in same room hearing each other's conversations

**Fix:** Verify unique room names per session
```typescript
// Check session ID generation
console.log('Session ID:', sessionStorage.getItem('voxa_session_id'));
console.log('Room Name:', livekitInfo?.roomName);

// Should be unique per user:
// ✅ business-123-session-1699123456789-abc123
// ❌ business-123 (same for everyone - WRONG!)
```

### Issue 2: Agent Not Dispatching

**Symptom:** Users connect but no agent joins

**Fix:** Check worker logs and room creation
```python
# Add logging in agent
logger.info(f"Worker received job request for room: {ctx.room.name}")

# Check LiveKit dashboard:
# - Is worker connected?
# - Are rooms being created?
# - Check worker logs for errors
```

### Issue 3: Cold Starts on Free Plan

**Symptom:** 10-20 second delay before agent joins

**Fix:** This is expected on Build plan. Solutions:
- Upgrade to paid plan for persistent workers
- Keep at least one test session open to keep workers warm
- Implement loading state in frontend

### Issue 4: Session Not Persisting

**Symptom:** Users can't reconnect to their session

**Fix:** Verify session storage
```typescript
// Debug session persistence
const debugSession = () => {
  console.log('Session ID:', sessionStorage.getItem('voxa_session_id'));
  console.log('Timestamp:', sessionStorage.getItem('voxa_session_timestamp'));
  console.log('Customer ID:', sessionStorage.getItem('customerId'));
};
```

## Summary

### Key Takeaways

1. **LiveKit Auto-Handles Concurrency**: You don't need custom orchestration - LiveKit dispatches agents automatically when rooms are created

2. **One Room = One Session**: Each user gets a unique room for complete privacy and context isolation

3. **Room Naming is Critical**:
   - Owners: `owner-${businessId}`
   - Customers: `${businessId}-session-${sessionId}`
   - General: `general-session-${sessionId}`

4. **Scalability is Built-In**: Add workers to scale, not code changes. Supports thousands of concurrent users

5. **All Three Cases Work**: Business managers, customer care, and general assistants all use the same architecture with different room naming

### Implementation Checklist

- [ ] Generate unique `sessionId` per user in frontend
- [ ] Create room name with session: `${businessId}-session-${sessionId}`
- [ ] Pass `sessionId` and metadata in token request
- [ ] Agent reads participant attributes for user context
- [ ] Simplify agent code - let LiveKit handle dispatch
- [ ] Test with multiple browsers/users simultaneously
- [ ] Verify room isolation in LiveKit dashboard
- [ ] Monitor worker load and scale horizontally as needed
