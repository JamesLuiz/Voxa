const LIVEKIT_WS = import.meta.env.VITE_LIVEKIT_WS || "wss://localhost";

export function getCustomerRoomUrl(businessId: string) {
  return `${LIVEKIT_WS}/customer/${encodeURIComponent(businessId)}`;
}

export function getOwnerRoomUrl() {
  return `${LIVEKIT_WS}/owner`;
}


