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
    // Pass the businessContext to prompt (simple template, TODO: improve prompt engineering)
    const promptPrefix = businessContext?.name ? `Business Info: Name: ${businessContext.name}, Description: ${businessContext.description} \n` : '';
    const prompt = `${promptPrefix}${payload.message}`;
    const roomName = 'default-room';
    // Fire-and-forget: attempt to send the text to the LiveKit room
    try {
      await this.livekit.sendRoomData(roomName, { type: 'text_message', role: 'owner', text: payload.message });
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
