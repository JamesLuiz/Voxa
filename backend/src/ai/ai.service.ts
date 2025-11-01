import { Injectable } from '@nestjs/common';
import { LiveKitService } from '../livekit.service';
import { HttpService } from '@nestjs/axios';

interface OwnerPayload {
  message: string;
  context?: Record<string, unknown>;
}

interface CustomerPayload {
  businessId: string;
  message: string;
}

@Injectable()
export class AiService {
  constructor(private readonly livekit: LiveKitService, private readonly httpService: HttpService) {}

  // For now, simple echo or placeholder. We forward the user message into
  // the LiveKit room as a data event so the running agent (if present) can
  // receive it and respond via voice.
  async ownerChat(payload: OwnerPayload) {
    let businessContext: any = {};
    // If context provides a businessId, fetch business context
    if (payload.context && payload.context.businessId) {
      try {
        const result = await this.httpService.axiosRef.get(
          `${process.env.BACKEND_BASE_URL || "http://localhost:3000"}/api/business/context/${payload.context.businessId}`
        );
        businessContext = result?.data || {};
      } catch {
        // Business context fetch failed
      }
    }
    // If the owner provided a customer identifier (id or email) attempt to fetch
    // the customer record so the agent can greet them by name and obtain their
    // business slug or other metadata.
    let customerRecord: any = null;
    try {
      if (payload.context && payload.context.customerId) {
        const cRes = await this.httpService.axiosRef.get(
          `${process.env.BACKEND_BASE_URL || "http://localhost:3000"}/api/crm/customers/${payload.context.customerId}`
        );
        customerRecord = cRes?.data || null;
      } else if (payload.context && payload.context.customerEmail) {
        const cRes = await this.httpService.axiosRef.get(
          `${process.env.BACKEND_BASE_URL || "http://localhost:3000"}/api/crm/customers/email/${encodeURIComponent(String(payload.context.customerEmail))}${payload.context.businessId ? `?businessId=${payload.context.businessId}` : ''}`
        );
        customerRecord = cRes?.data || null;
      } else if (payload.context && payload.context.businessId) {
        // As a fallback, try to pick a recent customer for the business so the
        // agent can greet whoever is most recently active.
        const listRes = await this.httpService.axiosRef.get(
          `${process.env.BACKEND_BASE_URL || "http://localhost:3000"}/api/crm/customers?businessId=${payload.context.businessId}`
        );
        const arr = listRes?.data || [];
        if (Array.isArray(arr) && arr.length > 0) {
          // prefer the most recent interaction if available
          arr.sort((a: any, b: any) => {
            const ta = a?.lastInteraction ? new Date(a.lastInteraction).getTime() : 0;
            const tb = b?.lastInteraction ? new Date(b.lastInteraction).getTime() : 0;
            return tb - ta;
          });
          customerRecord = arr[0];
        }
      }
    } catch (err) {
      // ignore customer fetch errors
    }
    // Pass the businessContext to prompt (simple template, TODO: improve prompt engineering)
    const promptPrefix = businessContext?.name ? `Business Info: Name: ${businessContext.name}, Description: ${businessContext.description} \n` : '';
    const prompt = `${promptPrefix}${payload.message}`;
    // Determine target LiveKit room name. If we have a businessId use that; else fallback.
    const roomName = (payload.context && (payload.context.businessId || payload.context.roomName))
      ? (payload.context.businessId || payload.context.roomName)
      : 'default-room';
    const roomNameStr = String(roomName || 'default-room');
    // Fire-and-forget: attempt to send the text to the LiveKit room
    try {
      // If we have a customer record, send a special greeting event so the
      // running agent or participants can play a spoken greeting.
      if (customerRecord) {
        const greeting = `Hello ${customerRecord.name || 'there'}, this is the support agent for ${businessContext?.name || 'your business'}. How can I help you today?`;
        await this.livekit.sendRoomData(roomNameStr, {
          type: 'agent_greeting',
          role: 'owner',
          text: greeting,
          customer: {
            id: String(customerRecord._id || customerRecord.id || ''),
            name: customerRecord.name || '',
            email: customerRecord.email || '',
            phone: customerRecord.phone || '',
          },
          business: {
            id: payload.context?.businessId || customerRecord.businessId || null,
            // business slug is available via business context if fetched
            slug: businessContext?.slug || null,
            name: businessContext?.name || null,
          }
        });
      } else {
        await this.livekit.sendRoomData(roomNameStr, { type: 'text_message', role: 'owner', text: payload.message });
      }
    } catch (e) {
      // ignore failures; fallback reply will still be returned
    }

    const reply = `Agent reply: ${prompt}`;
    return { reply };
  }

  async customerChat(payload: CustomerPayload) {
    let businessContext: any = {};
    if (payload.businessId) {
      try {
        const result = await this.httpService.axiosRef.get(
          `${process.env.BACKEND_BASE_URL || "http://localhost:3000"}/api/business/context/${payload.businessId}`
        );
        businessContext = result?.data || {};
      } catch {
        // Business context fetch failed
      }
    }
    const promptPrefix = businessContext?.name ? `Business Info: Name: ${businessContext.name}, Description: ${businessContext.description} \n` : '';
    const prompt = `${promptPrefix}${payload.message}`;
    const roomName = payload.businessId || 'default-room';
    try {
      await this.livekit.sendRoomData(roomName, { type: 'text_message', role: 'customer', text: payload.message, businessId: payload.businessId });
    } catch (e) {
      // ignore
    }

    const reply = `Customer assistant reply for business ${payload.businessId}: ${prompt}`;
    return { reply };
  }
}
