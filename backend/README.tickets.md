Tickets API notes

Create ticket endpoint: POST /api/tickets

Supported input variations:

- Customer flow (recommended):
  {
    "businessSlug": "my-business",
    "customerEmail": "alice@example.com",
    "customerName": "Alice",
    "title": "Problem with order",
    "description": "My order hasn't arrived",
    "priority": "high",
    "userEmail": "alice@example.com" // optional, used to attribute the request
  }

  If the customer does not exist, the controller will upsert a minimal customer record using the provided email and customerName (or email local-part as fallback).

- Owner flow (owner acts as business manager):
  {
    "businessSlug": "my-business",
    "title": "New internal task",
    "description": "Please review Q3 metrics",
    "userEmail": "owner@business.com" // MUST match business.owner.email to be treated as owner
  }

  If userEmail matches the business owner email, the controller will fetch owner and business details and return a richer response: { ticket, owner, business }.

Notes:
- You can also provide businessId and customerId instead of slugs/emails.
- For non-owner requests, either customerId or customerEmail is required.
- Response for customers is the created ticket document.

Testing locally:
- Ensure MongoDB is running and BACKEND is connected as in project README.
- Use curl or your HTTP client to POST JSON to /api/tickets.

Example curl (PowerShell):

$payload = '{"businessSlug":"my-business","customerEmail":"alice@example.com","title":"Hello","description":"Test"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/tickets -Body $payload -ContentType 'application/json'
