import { Injectable } from '@nestjs/common';
import { LiveKitService } from '../livekit.service';

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
  constructor(private readonly livekit: LiveKitService) {}

  // For now, simple echo or placeholder. We forward the user message into
  // the LiveKit room as a data event so the running agent (if present) can
  // receive it and respond via voice.
  async ownerChat(payload: OwnerPayload) {
    const roomName = 'default-room';
    // Fire-and-forget: attempt to send the text to the LiveKit room
    try {
      await this.livekit.sendRoomData(roomName, { type: 'text_message', role: 'owner', text: payload.message });
    } catch (e) {
      // ignore failures; fallback reply will still be returned
    }

    const reply = `Agent reply: ${payload.message}`;
    return { reply };
  }

  async customerChat(payload: CustomerPayload) {
    const roomName = payload.businessId || 'default-room';
    try {
      await this.livekit.sendRoomData(roomName, { type: 'text_message', role: 'customer', text: payload.message, businessId: payload.businessId });
    } catch (e) {
      // ignore
    }

    const reply = `Customer assistant reply for business ${payload.businessId}: ${payload.message}`;
    return { reply };
  }
}
