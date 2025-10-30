import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  // For now, simple echo or placeholder. In future, integrate with LLM or agent via WSS.
  async ownerChat(payload: { message: string; context?: Record<string, unknown> }) {
    // TODO: forward to agent via websocket and await response
    const reply = `Agent reply: ${payload.message}`;
    return { reply };
  }

  async customerChat(payload: { businessId: string; message: string }) {
    const reply = `Customer assistant reply for business ${payload.businessId}: ${payload.message}`;
    return { reply };
  }
}
