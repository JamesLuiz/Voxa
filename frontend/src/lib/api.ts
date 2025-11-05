const API_BASE = import.meta.env.VITE_API_URL ;

type RegisterPayload = {
  owner: { name: string; email: string; password: string };
  business: {
    name: string;
    industry: string;
    phone: string;
    email: string;
    website?: string;
    description?: string;
    products?: string[];
    policies?: string;
  };
};

export async function registerOwnerBusiness(payload: RegisterPayload) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = "Registration failed";
    try {
      const err = await res.json();
      msg = err?.message || msg;
    } catch (e) {
      // ignore
    }
    throw new Error(msg);
  }
  return (await res.json()) as { token: string; businessId: string };
}

type LoginPayload = { email: string; password: string };

export async function login(payload: LoginPayload) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = "Login failed";
    try {
      const err = await res.json();
      msg = err?.message || msg;
    } catch (e) {
      // ignore
    }
    throw new Error(msg);
  }
  return (await res.json()) as { token: string; businessId?: string };
}

export async function ownerChat(message: string, context?: Record<string, unknown>) {
  const token = localStorage.getItem("voxa_token") || "";
  const res = await fetch(`${API_BASE}/api/ai/owner/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, context }),
  });
  if (!res.ok) {
    let msg = "Chat failed";
    try {
      const err = await res.json();
      msg = err?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  const data = await res.json();
  return (data?.reply as string) || "";
}

export async function customerChat(businessId: string, message: string) {
  const res = await fetch(`${API_BASE}/api/ai/customer/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, message }),
  });
  if (!res.ok) throw new Error("Chat failed");
  const data = await res.json();
  return (data?.reply as string) || "";
}

// Fetch owner details from backend
export async function getOwnerByBusinessId(businessId: string) {
  const token = localStorage.getItem("voxa_token") || "";
  const res = await fetch(`${API_BASE}/api/business/${businessId}/owner`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return (await res.json()) as { name?: string; email?: string } | null;
}

// Fetch general user details from backend
export async function getGeneralUserByEmail(email: string) {
  const token = localStorage.getItem("voxa_general_token") || "";
  const encodedEmail = encodeURIComponent(email);
  const res = await fetch(`${API_BASE}/api/auth/general/user/${encodedEmail}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return (await res.json()) as { name?: string; email?: string; location?: string } | null;
}

// Fetch customer details from backend
export async function getCustomerByEmail(email: string, businessId: string) {
  const token = localStorage.getItem("voxa_token") || "";
  const encodedEmail = encodeURIComponent(email);
  const res = await fetch(`${API_BASE}/api/crm/customers/email/${encodedEmail}?businessId=${businessId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return (await res.json()) as { name?: string; email?: string; _id?: string; id?: string } | null;
}

export async function getLivekitToken(params: { role: "customer" | "owner" | "general"; businessId?: string; userName?: string; userEmail?: string }) {
  const token = localStorage.getItem("voxa_token") || localStorage.getItem('voxa_general_token') || "";
  const qs: Record<string, string> = { role: params.role, businessId: params.businessId || "" };
  if (params.userName) qs.userName = params.userName;
  if (params.userEmail) qs.userEmail = params.userEmail;
  const query = new URLSearchParams(qs).toString();
  const res = await fetch(`${API_BASE}/api/livekit/token?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to get LiveKit token");
  return (await res.json()) as { token: string; serverUrl: string };
}

export async function listTickets(params?: { status?: "open" | "in-progress" | "resolved" | "closed" }) {
  const token = localStorage.getItem("voxa_token") || "";
  const businessId = localStorage.getItem("voxa_business_id") || "";
  const url = new URL(`${API_BASE}/api/tickets`);
  if (businessId) url.searchParams.set("businessId", businessId);
  if (params?.status) url.searchParams.set("status", params.status);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load tickets");
  const data = await res.json();
  // Normalize ids for UI components
  if (Array.isArray(data)) {
    return data.map((t) => ({ ...t, id: t._id || t.id }));
  }
  return data;
}

// CRM
export async function listCustomers(params?: { q?: string }) {
  const token = localStorage.getItem("voxa_token") || "";
  const url = new URL(`${API_BASE}/api/crm/customers`);
  if (params?.q) url.searchParams.set("q", params.q);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load customers");
  return res.json();
}

export async function createCustomer(payload: { businessId?: string; name: string; email?: string; phone?: string; tags?: string[] }) {
  const token = localStorage.getItem("voxa_token") || "";
  const businessId = localStorage.getItem('voxa_business_id') || '';
  const body = { businessId, ...payload }; // Keep the existing body structure
  const res = await fetch(`${API_BASE}/api/crm/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create customer");
  return res.json();
}

export async function upsertCustomer(payload: { businessId: string; name: string; email: string; phone?: string; company?: string }) {
  const res = await fetch(`${API_BASE}/api/crm/customers/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to upsert customer");
  return res.json();
}

// Tickets
export async function updateTicketStatus(id: string, status: "open" | "in-progress" | "resolved" | "closed") {
  const token = localStorage.getItem("voxa_token") || "";
  const res = await fetch(`${API_BASE}/api/tickets/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update ticket");
  return res.json();
}

export async function assignTicket(id: string, assignedTo: string) {
  const token = localStorage.getItem("voxa_token") || "";
  const res = await fetch(`${API_BASE}/api/tickets/${id}/assign`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assignedTo }),
  });
  if (!res.ok) throw new Error("Failed to assign ticket");
  return res.json();
}

export async function addTicketNote(id: string, note: string) {
  const token = localStorage.getItem("voxa_token") || "";
  const res = await fetch(`${API_BASE}/api/tickets/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error("Failed to add note");
  return res.json();
}

export async function getLatestTicket(businessId: string, customerEmail: string) {
  const url = new URL(`${API_BASE}/api/tickets/latest`);
  url.searchParams.set('businessId', businessId);
  url.searchParams.set('customerEmail', customerEmail);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch latest ticket');
  return res.json();
}

export async function createTicketForEmail(params: { businessId: string; customerEmail: string; title?: string; description?: string; priority?: 'low'|'medium'|'high'|'urgent' }) {
  const token = localStorage.getItem("voxa_token") || "";
  const res = await fetch(`${API_BASE}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      businessId: params.businessId,
      userEmail: params.customerEmail,
      title: params.title || 'Support Request',
      description: params.description || '',
      priority: params.priority || 'low',
    })
  });
  if (!res.ok) throw new Error("Failed to create ticket");
  return res.json();
}

// Meetings
export async function listMeetings(range?: { from?: string; to?: string }) {
  const token = localStorage.getItem("voxa_token") || "";
  const businessId = localStorage.getItem('voxa_business_id') || '';
  const url = new URL(`${API_BASE}/api/meetings`);
  if (businessId) url.searchParams.set("businessId", businessId);
  if (range?.from) url.searchParams.set("from", range.from);
  if (range?.to) url.searchParams.set("to", range.to);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load meetings");
  const data = await res.json();
  // Backend now returns normalized data with id, startsAt, and with fields
  // Just ensure it's an array
  return Array.isArray(data) ? data : [];
}

export async function createMeeting(payload: { title: string; startsAt: string; durationMins?: number; with?: string }) {
  const token = localStorage.getItem("voxa_token") || "";
  // Backend expects startTime and duration (mins). Map frontend payload accordingly.
  const businessId = localStorage.getItem('voxa_business_id') || '';
  
  if (!businessId) {
    throw new Error("Business ID is required to create a meeting");
  }
  
  // Handle customerId - if "with" is provided, it could be an email or customer ID
  // For owner-initiated meetings, customerId is optional
  let customerId: string | undefined = undefined;
  const attendees: string[] = [];
  
  if (payload.with) {
    // If "with" looks like an email, include it in attendees
    // If it looks like an ObjectId, treat it as customerId
    if (payload.with.includes('@')) {
      attendees.push(payload.with);
    } else if (/^[0-9a-fA-F]{24}$/.test(payload.with)) {
      // Looks like a MongoDB ObjectId
      customerId = payload.with;
    } else {
      // Treat as attendee name/email
      attendees.push(payload.with);
    }
  }
  
  const body: any = {
    businessId,
    title: payload.title,
    startTime: payload.startsAt, // Backend expects startTime
    duration: payload.durationMins || 30,
    attendees: attendees.length > 0 ? attendees : undefined,
  };
  
  // Only include customerId if we have one
  if (customerId) {
    body.customerId = customerId;
  }

  const res = await fetch(`${API_BASE}/api/meetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create meeting: ${errorText}`);
  }
  const result = await res.json();
  // Normalize the response to match frontend expectations
  return {
    ...result,
    id: result._id || result.id,
    startsAt: result.startTime || result.startsAt,
  };
}

// Analytics
export async function getAnalyticsSummary(businessId?: string) {
  const token = localStorage.getItem("voxa_token") || "";
  const url = new URL(`${API_BASE}/api/analytics/overview`);
  if (businessId) url.searchParams.set("businessId", businessId);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let msg = "Failed to load analytics";
    try {
      const err = await res.json();
      msg = err?.message || msg;
    } catch (_) {
      /* ignore parsing error */
    }
    throw new Error(msg);
  }
  const data = await res.json();
  // Backend returns { totalCustomers, openTickets, upcomingMeetings, commonQueries }
  // Normalize to frontend shape and include newer analytics fields
  return {
    tickets: {
      open: data?.openTickets ?? 0,
      progress: data?.inProgressTickets ?? 0,
      resolved: data?.resolvedTickets ?? 0,
    },
    customers: { total: data?.totalCustomers ?? 0 },
    queries: Array.isArray(data?.commonQueries) ? data.commonQueries : [],
    // New fields returned by backend overview
    conversations: data?.conversations ?? 0,
    resolutionRate: data?.resolutionRate ?? 0,
    recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
  } as {
    tickets: { open: number; progress: number; resolved: number };
    customers: { total: number };
    queries: any[];
    conversations: number;
    resolutionRate: number;
    recentActivity: any[];
  };
}


