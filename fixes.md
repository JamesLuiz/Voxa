# LiveKit Agent Role Recognition Issue - Problem Analysis & Fix

## Problem Statement

The LiveKit agent does not recognize who is on the call (owner, customer, or general user). The agent provides the same generic greeting and behavior regardless of whether an owner, customer, or general user initiates the call.

## Root Cause Analysis

### Current Implementation Issues

1. **Role Information Not Passed to Agent**
   - The `effectiveRole` is calculated correctly in `CustomerChat.tsx`
   - Role is sent to `getLivekitToken()` as `kvRole` parameter
   - However, the role is only used for token generation, not embedded in participant metadata
   - **The agent has no way to read the role** when the participant joins

2. **Missing Participant Attributes**
   - LiveKit agents access user information via participant attributes/metadata
   - Current code does NOT set participant attributes with role information
   - The `LiveKitRoom` component connects without passing role metadata

3. **Agent Cannot Differentiate Users**
   - Without participant attributes containing role info, the agent treats everyone as generic users
   - Agent cannot customize greetings (e.g., "Welcome back, business owner" vs "How can I help you today, customer")
   - Agent cannot adjust behavior based on user type (owner commands vs customer support)

## Current Code Flow

```
CustomerChat.tsx
  ├── Determines effectiveRole: 'owner' | 'customer' | 'general'
  ├── Fetches user data (name, email) from database
  ├── Calls getLivekitToken({ role: kvRole, businessId, userName, userEmail })
  │     └── Backend generates token (role used for permissions only)
  └── Connects to LiveKitRoom with token
        └── Agent receives connection but NO role information ❌
```

## Proposed Solution

### Overview

Pass role and user context as **participant attributes** in the LiveKit token so the agent can read them when the user connects.

### Frontend Changes (CustomerChat.tsx)

**Location**: `handleStartCall()` function, line ~150

**Change**: Add `metadata` object to `getLivekitToken()` call

```typescript
const info = await getLivekitToken({ 
  role: kvRole, 
  businessId, 
  userName, 
  userEmail,
  // NEW: Include role in metadata for agent to read
  metadata: { 
    userRole: kvRole,              // 'owner', 'customer', or 'general'
    businessId: businessId,         // Business context
    userName: userName || 'Guest',  // User's name
    userEmail: userEmail || ''      // User's email
  }
});
```

### Backend Changes (Token Generation API)

**Location**: Your backend API endpoint that generates LiveKit tokens (e.g., `api.ts`, `livekit.service.ts`)

**Change**: Embed metadata as participant attributes in the AccessToken

```typescript
// TypeScript/Node.js example
import { AccessToken } from 'livekit-server-sdk';

export async function getLivekitToken({ 
  role, 
  businessId, 
  userName, 
  userEmail,
  metadata 
}: { 
  role: string; 
  businessId: string; 
  userName?: string; 
  userEmail?: string;
  metadata?: Record<string, any>;
}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  
  // Create unique identity
  const identity = `${role}-${userEmail || Date.now()}`;
  
  // NEW: Create token with participant attributes
  const at = new AccessToken(apiKey, apiSecret, {
    identity: identity,
    name: userName || 'Guest',
    // Participant attributes - accessible by agent
    attributes: {
      role: metadata?.userRole || role,
      businessId: metadata?.businessId || businessId,
      userName: metadata?.userName || userName || 'Guest',
      userEmail: metadata?.userEmail || userEmail || '',
    },
  });
  
  // Grant permissions
  at.addGrant({
    room: `business-${businessId}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  
  const token = await at.toJwt();
  return {
    token,
    serverUrl: process.env.LIVEKIT_URL
  };
}
```

### Agent Changes (Python Worker)

**Location**: Your LiveKit agent entrypoint (Python worker)

**Change**: Read participant attributes and customize behavior

```python
from livekit.agents import JobContext, Agent, AgentSession

async def entrypoint(ctx: JobContext):
    """Agent entrypoint - reads user role and customizes behavior"""
    
    await ctx.connect()
    
    # Get the participant who triggered the call
    participant = None
    for p in ctx.room.remote_participants.values():
        participant = p
        break
    
    # Read role from participant attributes
    user_role = participant.attributes.get('role', 'customer') if participant else 'customer'
    user_name = participant.attributes.get('userName', 'Guest') if participant else 'Guest'
    user_email = participant.attributes.get('userEmail', '') if participant else ''
    business_id = participant.attributes.get('businessId', '') if participant else ''
    
    # Customize instructions based on role
    if user_role == 'owner':
        instructions = f"""You are Voxa, the AI assistant for business owners.
        
        You're speaking with {user_name}, the owner of this business.
        
        Your role:
        - Greet them professionally as a business owner
        - Help with business management tasks
        - Provide ticket reviews and customer insights
        - Assist with scheduling and team coordination
        - Answer questions about business analytics
        
        Be professional, efficient, and focused on business value."""
        
    elif user_role == 'general':
        instructions = f"""You are Voxa, a helpful AI assistant.
        
        You're speaking with {user_name}, a general user.
        
        Your role:
        - Greet them warmly and professionally
        - Provide general assistance
        - Answer questions clearly and helpfully
        - Be friendly and approachable"""
        
    else:  # customer
        instructions = f"""You are Voxa, a customer support AI assistant.
        
        You're speaking with {user_name}, a customer seeking support.
        
        Your role:
        - Greet them warmly and empathetically
        - Ask how you can help with their support needs
        - Create support tickets when needed
        - Provide clear, helpful answers
        - Be patient and understanding
        
        Focus on solving their problems and making them feel heard."""
    
    # Create agent with role-specific instructions
    agent = Agent(
        instructions=instructions,
        tools=[...]  # Your existing tools
    )
    
    # Start session
    session = AgentSession(...)
    await session.start(agent=agent, room=ctx.room)
    
    # Generate personalized greeting
    greeting_context = {
        'owner': f"as a business owner named {user_name}",
        'general': f"as a user named {user_name}",
        'customer': f"as a customer named {user_name} who needs support"
    }
    
    await session.generate_reply(
        instructions=f"Greet the person warmly {greeting_context.get(user_role, '')}"
    )
```

## Expected Behavior After Fix

### For Owners
```
Agent: "Welcome back, [Name]! I'm Voxa, your business AI assistant. 
        I can help you review open tickets, check customer insights, 
        or schedule follow-ups. What would you like to do?"
```

### For Customers
```
Agent: "Hi [Name]! I'm Voxa, your support assistant. 
        How can I help you today? I'm here to answer questions 
        or create a support ticket if needed."
```

### For General Users
```
Agent: "Hello [Name]! I'm Voxa, your AI assistant. 
        How can I assist you today?"
```

## Implementation Checklist

- [ ] Update `CustomerChat.tsx` - add metadata to `getLivekitToken()` call
- [ ] Update backend token generation - add participant attributes to AccessToken
- [ ] Update agent worker - read participant attributes and customize instructions
- [ ] Test with owner login - verify owner-specific greeting
- [ ] Test with customer (no login) - verify customer support greeting
- [ ] Test with general user login - verify general greeting
- [ ] Verify agent behavior matches role (owner gets business tools, customers get support)

## Testing Steps

1. **Test as Owner**
   - Login as business owner
   - Navigate to chat page
   - Start voice call
   - Expected: "Welcome back, [Name]! I'm your business assistant..."

2. **Test as Customer**
   - Open chat page without login (or use incognito)
   - Provide name/email when prompted
   - Start voice call
   - Expected: "Hi [Name]! I'm your support assistant..."

3. **Test as General User**
   - Login with general user account
   - Navigate to chat page
   - Start voice call
   - Expected: "Hello [Name]! I'm your AI assistant..."

## Additional Notes

- Participant attributes are accessible throughout the session
- Agent can reference role at any point (not just greeting)
- Role can be used to enable/disable certain tools or commands
- Consider logging role information for analytics/debugging

## References

- LiveKit Agent Documentation: Participant Attributes
- LiveKit Server SDK: AccessToken API
- Your codebase: `CustomerChat.tsx`, token generation endpoint, agent worker