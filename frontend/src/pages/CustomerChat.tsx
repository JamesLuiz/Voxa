import { useState, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import voxaLogo from "@/assets/voxa-logo.png";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { customerChat, ownerChat, getLivekitToken, upsertCustomer, getLatestTicket, createTicketForEmail } from "@/lib/api.ts";
import { getCustomerRoomUrl } from "@/lib/livekit";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { GridLayout, ParticipantTile, TrackToggle, useRoomContext } from "@livekit/components-react";
import { Track, DataPacket_Kind } from "livekit-client";
import { LocalParticipant } from "livekit-client";
const API_BASE = import.meta.env.VITE_API_URL ;


const CustomerChat = ({ role = 'customer' }: { role?: 'customer' | 'owner' }) => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("Acme Corp");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [livekitInfo, setLivekitInfo] = useState<{ token: string; serverUrl: string } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(() => sessionStorage.getItem('customerId'));
  const [collectStep, setCollectStep] = useState<'none'|'name'|'email'|'phone'|'done'>('none');
  const [pendingCustomerInfo, setPendingCustomerInfo] = useState<{name?: string; email?: string; phone?: string}>({});
  const [errorBanner, setErrorBanner] = useState<string>("");
  const [reconnectOffer, setReconnectOffer] = useState<boolean>(false);
  const [ticketBanner, setTicketBanner] = useState<{ id: string } | null>(null);
  const [emailUpdates, setEmailUpdates] = useState<boolean>(() => {
    try { return localStorage.getItem('voxa_email_updates') === '1'; } catch { return true; }
  });

  useEffect(() => {
    // Resolve business via slug param
    (async () => {
      if (!slug) return;
      try {
        const res = await fetch(`${API_BASE}/api/business/by-slug/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.businessId) setBusinessId(data.businessId);
          if (data?.name) setBusinessName(String(data.name));
        }
      } catch {
        // ignore; UI can show generic state
      }
    })();
  // On mount, if no customerId and we're a customer, start collecting info
  if (!customerId && role === 'customer') setCollectStep('name');
  }, [customerId, slug]);

  async function handleCustomerIdentityInput(input: string): Promise<string> {
    // Simulated decision tree for AI/agent: in real deployment you may merge with LLM backend!
    if (collectStep === 'name') {
      setPendingCustomerInfo((prev) => ({ ...prev, name: input.trim() }));
      setCollectStep('email');
      return "Thanks! Could you share your email address? You'll get updates there.";
    } else if (collectStep === 'email') {
      const valid = /^\S+@\S+\.\S+$/.test(input.trim());
      if (!valid) return "Hmm, that email doesn’t look right. Try again (example: you@site.com).";
      setPendingCustomerInfo((prev) => ({ ...prev, email: input.trim() }));
      setCollectStep('phone');
      return "Optional: Share your phone number, or type 'skip'.";
    } else if (collectStep === 'phone') {
      // allow skip
      const phoneValue = input.trim().toLowerCase() === 'skip' ? '' : input.trim();
      const finalInfo = { ...pendingCustomerInfo, phone: phoneValue };
      setPendingCustomerInfo(finalInfo);
      setCollectStep('done');
      try {
        const res: any = await upsertCustomer({
          businessId,
          name: finalInfo.name || '',
          email: finalInfo.email || '',
          phone: finalInfo.phone || '',
        });
        const _id = res?._id || res?.id || null;
        if (_id) {
          setCustomerId(_id);
          sessionStorage.setItem('customerId', _id);
        }
        // Ensure a ticket exists for this customer
        try {
          if (finalInfo.email) {
            const created = await createTicketForEmail({
              businessId,
              customerEmail: finalInfo.email,
              title: 'Support Request',
            });
            const tId = created?.ticket?._id || created?._id || created?.id;
            if (tId) {
              setTicketBanner({ id: String(tId) });
            } else {
              // fallback: fetch latest
              const t = await getLatestTicket(businessId, finalInfo.email);
              if (t && (t._id || t.id)) {
                setTicketBanner({ id: String(t._id || t.id) });
              }
            }
          }
        } catch {}
        return "You’re all set! I’ve saved your details and opened a support ticket.";
      } catch (err) {
        setCollectStep('none');
        return "Sorry, we could not save your info. Please try again later.";
      }
    }
    return "";
  }

  function getAiPromptForStep() {
    if (collectStep === 'name') return "Welcome! What’s your name?";
    if (collectStep === 'email') return "Great, what’s your email? I’ll use it for updates.";
    if (collectStep === 'phone') return "Phone is optional. You can enter it now or type 'skip'.";
    return null;
  }

  const handleStartCall = async () => {
    setIsConnecting(true);
    try {
      // Always generate a fresh token for each connection attempt
      // This ensures clean reconnection after disconnects
      const info = await getLivekitToken({ role: role === 'owner' ? 'owner' : 'customer', businessId });
      
      // Clear any stale state
      setLivekitInfo(null);
      setIsCallActive(false);
      
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set new token and activate call
      setLivekitInfo(info);
      setIsCallActive(true);
      setErrorBanner("");
      try { localStorage.setItem('voxa_last_session', JSON.stringify({ role, businessId })); } catch {}
      
      // If owner is initiating the call, notify backend so agent can fetch
      // customer details and greet them when the room connects.
      if (role === 'owner') {
        try {
          await ownerChat('call_started', { businessId });
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to start call:', e);
      setIsCallActive(false);
      setLivekitInfo(null);
      setErrorBanner('Could not start the call. Check your connection and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEndCall = () => {
    // Clear all state to allow clean reconnection
    setIsCallActive(false);
    setLivekitInfo(null);
    // Clear session storage flags
    try {
      sessionStorage.removeItem('voxa_call_active');
      sessionStorage.removeItem('voxa_pending_text');
    } catch (e) {
      // ignore
    }
    setReconnectOffer(true);
  };

  const VoiceInline = () => {
    const { state, audioTrack } = useVoiceAssistant();
    return (
      <div className="w-full">
        <div className="w-full flex items-center justify-center gap-1 h-12 sm:h-16">
          {audioTrack && <BarVisualizer barCount={10} trackRef={audioTrack} className="w-full" />}
        </div>
        <div className="mt-2 sm:mt-3 flex justify-center"><VoiceAssistantControlBar /></div>
        <RoomAudioRenderer />
      </div>
    );
  };

  const DisconnectButton = ({ onEnded }: { onEnded: () => void }) => {
    const room = useRoomContext();
    return (
      <Button
        size="lg"
        variant="destructive"
        className="gap-2 sm:gap-3 mt-3 sm:mt-4 w-full sm:w-auto text-sm sm:text-base"
        onClick={async () => {
          try {
            const local = (room as any)?.localParticipant;

            if (local) {
              try {
                // Prefer SDK methods if available. We call publication.unpublish() (if present)
                // and then stop the underlying media track. Avoid calling participant-level
                // unpublish helpers with raw MediaStreamTracks which can cause the SDK to
                // forward the wrong type to RTCPeerConnection.removeTrack (causing the
                // "Argument 1 is not of type 'RTCRtpSender'" TypeError).
                if (typeof local.getTrackPublications === 'function') {
                  const pubs: any[] = Array.from(local.getTrackPublications() as Iterable<any>);
                  for (const p of pubs) {
                    try {
                      // If the publication exposes an unpublish method, use it.
                      if (p && typeof p.unpublish === 'function') {
                        try { await p.unpublish(); } catch {}
                      }

                      // Stop the underlying media track (if present). The track may be
                      // a LocalAudioTrack/LocalVideoTrack wrapper with a `stop()` method
                      // or a plain MediaStreamTrack in some older SDK shapes.
                      const maybeTrack = (p as any)?.track ?? (p as any)?.mediaStreamTrack;
                      if (maybeTrack && typeof maybeTrack.stop === 'function') {
                        try { maybeTrack.stop(); } catch {}
                      }
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.warn('could not unpublish/stop publication', { room: room?.name, error: err });
                    }
                  }
                } else if (local && (local.tracks instanceof Map || (local.tracks && typeof local.tracks.values === 'function'))) {
                  // Older SDK shapes: iterate track values and attempt to unpublish/stop
                  const vals = Array.from((local.tracks as Map<any, any>).values());
                  for (const t of vals) {
                    try {
                      if (t && typeof t.unpublish === 'function') {
                        try { await t.unpublish(); } catch {}
                      }
                      if (t && typeof (t as any).stop === 'function') {
                        try { (t as any).stop(); } catch {}
                      }
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.warn('could not unpublish/stop track', { room: room?.name, error: err });
                    }
                  }
                }
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('could not cleanup local participant tracks', err);
              }
            } else {
              // no local participant - as last resort disconnect
              // If there's no local participant, try disconnect as a last resort.
              if (typeof room?.disconnect === 'function') {
                try { await room.disconnect(); } catch (e) { /* ignore */ }
              }
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('error while ending call', e);
          }

          onEnded();
        }}
      >
        <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
        End Call
      </Button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {ticketBanner && (
        <div className="bg-primary/10 text-primary text-xs sm:text-sm px-3 py-2 text-center flex flex-col sm:flex-row gap-2 sm:gap-3 items-center justify-center">
          <div>
            Ticket created: <span className="font-semibold">{ticketBanner.id}</span>
          </div>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={emailUpdates} onChange={(e) => { setEmailUpdates(e.target.checked); try { localStorage.setItem('voxa_email_updates', e.target.checked ? '1' : '0'); } catch {} }} />
            Receive updates by email
          </label>
          <button className="underline" onClick={() => setTicketBanner(null)}>Dismiss</button>
        </div>
      )}
      {errorBanner && (
        <div className="bg-destructive/10 text-destructive text-xs sm:text-sm px-3 py-2 text-center">{errorBanner} <button className="underline" onClick={handleStartCall}>Retry</button></div>
      )}
      {reconnectOffer && !isCallActive && (
        <div className="bg-primary/10 text-primary text-xs sm:text-sm px-3 py-2 text-center">Reconnect to your last session? <button className="underline" onClick={() => { setReconnectOffer(false); handleStartCall(); }}>Reconnect</button></div>
      )}
      {/* Header */}
      <header className="glass border-b border-border p-4 sm:p-6">
        <div className="max-w-6xl mx-auto flex items-center gap-3 sm:gap-4">
          <img src={voxaLogo} alt={businessName} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{businessName}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">AI Voice Assistant</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 md:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Voice Call Section */}
        <div className="flex-1 flex flex-col items-center justify-center glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
          {!isCallActive ? (
            <div className="text-center space-y-4 sm:space-y-6 md:space-y-8 animate-fade-in">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-primary" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Start Voice Call</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Talk to our AI assistant instantly
                </p>
              </div>
              <Button
                size="lg"
                className="gap-2 sm:gap-3 text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 rounded-full w-full sm:w-auto"
                onClick={handleStartCall}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5 sm:w-6 sm:h-6" />
                    Start Call
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="w-full animate-fade-in">
              {livekitInfo && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <LiveKitRoom
                    key={`room-${livekitInfo.token.slice(-10)}`}
                    serverUrl={livekitInfo.serverUrl || getCustomerRoomUrl(businessId)}
                    token={livekitInfo.token}
                    connect
                    audio
                    video
                    style={{ height: "auto", minHeight: 280 }}
                    onDisconnected={(reason) => {
                      // Handle disconnection gracefully - allow immediate reconnection
                      // eslint-disable-next-line no-console
                      console.log('Room disconnected:', reason);
                      setIsCallActive(false);
                      setLivekitInfo(null);
                      // Clear state to allow fresh reconnection
                      try {
                        sessionStorage.removeItem('voxa_call_active');
                        sessionStorage.removeItem('voxa_pending_text');
                      } catch (e) {
                        // ignore
                      }
                    }}
                  >
                    <PublishPendingText />
                    <AgentChatListener onMessage={(msg) => {
                      // Update chat interface with agent messages
                      const chatEvent = new CustomEvent('voxa-agent-message', { detail: msg });
                      window.dispatchEvent(chatEvent);
                    }} />
                    <div className="grid grid-rows-[1fr_auto]">
                      <div className="p-2 sm:p-3">
                        <GridLayout tracks={[]}>
                          <ParticipantTile />
                        </GridLayout>
                      </div>
                      <div className="p-2 sm:p-3 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-2">
                          <TrackToggle source={Track.Source.Microphone} />
                          <TrackToggle source={Track.Source.Camera} />
                        </div>
                        <div className="mt-2 sm:mt-3 w-full"><VoiceInline /></div>
                        <DisconnectButton onEnded={handleEndCall} />
                      </div>
                    </div>
                  </LiveKitRoom>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Interface Section */}
        <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0">
          <div className="mb-3 sm:mb-4">
            <h3 className="text-lg sm:text-xl font-bold">Text Chat</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Type your message and AI will respond with voice
            </p>
          </div>
          <div className="flex-1">
            <ChatInterface 
              mode={role === 'owner' ? 'owner' : 'customer'} 
              businessName={businessName} 
              onSend={async (text) => {
                // Only handle text if call is not active (fallback for when voice is off)
                const isCallActive = sessionStorage.getItem('voxa_call_active');
                if (isCallActive) {
                  // During active calls, text is sent via LiveKit data channel
                  // Agent responds in real-time via voice/text - no mock response needed
                  return '';
                }
                
                // Owner text intents (lightweight) when call inactive
                if (role === 'owner') {
                  const t = text.toLowerCase();
                  if (t.includes('show') && t.includes('open tickets')) {
                    navigate('/dashboard/tickets');
                    return 'Opening Tickets…';
                  }
                  const assignMatch = t.match(/assign\s+ticket\s+(\w+)\s+to\s+([\w@.\-+]+)/);
                  if (assignMatch) {
                    try {
                      await fetch(`${API_BASE}/api/tickets/${assignMatch[1]}/assign`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedTo: assignMatch[2] }) });
                      return `Assigned ticket ${assignMatch[1]} to ${assignMatch[2]}.`;
                    } catch {
                      return 'Failed to assign ticket.';
                    }
                  }
                  const followMatch = t.match(/schedule\s+follow[- ]?up\s+for\s+ticket\s+(\w+)/);
                  if (followMatch) {
                    try {
                      const title = `Follow-up for ticket ${followMatch[1]}`;
                      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                      await fetch(`${API_BASE}/api/meetings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, startsAt, durationMins: 30 }) });
                      return `Scheduled a follow-up meeting for ticket ${followMatch[1]}.`;
                    } catch {
                      return 'Failed to schedule follow-up.';
                    }
                  }
                  // Otherwise, start the call
                  await handleStartCall();
                  return '';
                }
                // For customers without active call, start call
                await handleStartCall();
                return '';
              }} 
              onStartVoice={() => handleStartCall()} 
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-border p-3 sm:p-4 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Powered by <span className="text-primary font-semibold">Voxa</span>
        </p>
      </footer>
    </div>
  );
};

export default CustomerChat;

function PublishPendingText() {
  const room = useRoomContext();
  useEffect(() => {
    let active = true;
    let lastPublished = '';
    let connectionCheckInterval: NodeJS.Timeout | null = null;

    const publishIfPending = async () => {
      try {
        // Don't try to publish if room is not connected
        if (!room || (room as any)?.state !== 'connected') {
          return;
        }
        
        const pending = sessionStorage.getItem('voxa_pending_text');
        if (!pending || pending === lastPublished) return;
        
        const lp = (room as any)?.localParticipant as LocalParticipant | undefined;
        if (!lp) {
          // Wait for participant to be ready
          return;
        }
        
        // Check if room is connected instead
        if (room && (room as any)?.state !== 'connected') {
          return;
        }
        
        const sendTextMessage = async () => {
          try {
            // Parse the pending text to extract the message
            let textMessage = '';
            try {
              const parsed = JSON.parse(pending);
              if (parsed && parsed.type === 'text_message' && parsed.text) {
                textMessage = parsed.text;
              } else if (typeof parsed === 'string') {
                textMessage = parsed;
              }
            } catch {
              // Not JSON, use as is
              textMessage = pending;
            }
            
            if (!textMessage.trim()) {
              return;
            }
            
            // Use sendText with lk.chat topic (as per LiveKit documentation)
            // This is the proper way to send text messages that agents receive
            if (typeof (lp as any).sendText === 'function') {
              await (lp as any).sendText(textMessage, { topic: 'lk.chat' });
            } else if (typeof (lp as any).publishData === 'function') {
              // Fallback to publishData if sendText is not available
              // Include topic in the message payload - agent will check for lk.chat topic
              const message = JSON.stringify({
                type: 'text_message',
                text: textMessage,
                topic: 'lk.chat'
              });
              const enc = new TextEncoder().encode(message);
              // Use publishData with reliable kind - topic can be extracted from payload by agent
              await (lp as any).publishData(enc, DataPacket_Kind.RELIABLE);
            }
            
            lastPublished = pending;
            sessionStorage.removeItem('voxa_pending_text');
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Failed to send text message', err);
          }
        };

        await sendTextMessage();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
      }
    };

    // Mark call active only when room is connected
    const markCallActive = () => {
      if (room && (room as any)?.state === 'connected') {
        sessionStorage.setItem('voxa_call_active', '1');
      }
    };

    // Listen for room connection events
    const handleConnected = () => {
      markCallActive();
      publishIfPending();
    };

    const handleDisconnected = () => {
      sessionStorage.removeItem('voxa_call_active');
      sessionStorage.removeItem('voxa_pending_text');
      active = false;
    };

    // Attach room event listeners
    if (room && typeof (room as any).on === 'function') {
      (room as any).on('connected', handleConnected);
      (room as any).on('disconnected', handleDisconnected);
      (room as any).on('reconnecting', () => {
        // Keep call active during reconnection
        sessionStorage.setItem('voxa_call_active', '1');
      });
      (room as any).on('reconnected', handleConnected);
    }

    // Check connection status periodically
    if (room) {
      connectionCheckInterval = setInterval(() => {
        if (room && (room as any)?.state === 'connected') {
          markCallActive();
        } else {
          sessionStorage.removeItem('voxa_call_active');
        }
      }, 1000);
    }

    // Mark active if already connected
    if (room && (room as any)?.state === 'connected') {
      markCallActive();
      publishIfPending();
    }

    // Listen for publish triggers (both storage events and custom events)
    const onStorage = (ev: StorageEvent | CustomEvent) => {
      if ((ev instanceof StorageEvent && ev.key === 'voxa_publish_trigger') || 
          (ev instanceof CustomEvent && ev.type === 'voxa-publish-text')) {
        if (active && room && (room as any)?.state === 'connected') {
          publishIfPending();
        }
      }
    };

    window.addEventListener('storage', onStorage as EventListener);
    window.addEventListener('voxa-publish-text', onStorage as EventListener);
    
    // Poll for pending messages more frequently
    const interval = setInterval(() => {
      if (active && room && (room as any)?.state === 'connected') {
        publishIfPending();
      }
    }, 200); // Poll every 200ms for faster response

    return () => {
      active = false;
      window.removeEventListener('storage', onStorage as EventListener);
      window.removeEventListener('voxa-publish-text', onStorage as EventListener);
      clearInterval(interval);
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      if (room && typeof (room as any).off === 'function') {
        (room as any).off('connected', handleConnected);
        (room as any).off('disconnected', handleDisconnected);
      }
    };
  }, [room]);
  return null;
}

function AgentChatListener({ onMessage }: { onMessage: (msg: string) => void }) {
  const room = useRoomContext();
  
  useEffect(() => {
    if (!room) return;
    
    // Listen for data messages from agent (agent can send text responses)
    const handleData = (payload: any) => {
      try {
        let text = '';
        let data: any = payload;
        
        // Handle different payload types
        if (payload?.data) {
          data = payload.data;
        }
        
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
          const decoder = new TextDecoder();
          text = decoder.decode(data);
        } else if (typeof data === 'string') {
          text = data;
        } else if (payload?.text) {
          text = payload.text;
        }
        
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.type === 'agent_response' && parsed.text) {
              onMessage(parsed.text);
            } else if (parsed.text) {
              onMessage(parsed.text);
            }
          } catch {
            // Not JSON, treat as plain text (but only if it's from agent)
            // Filter out user messages
            if (text.trim() && !text.includes('text_message')) {
              onMessage(text);
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Error handling agent data', err);
      }
    };
    
    // Listen for transcription events from LiveKit (agent speech-to-text)
    const handleTranscription = (event: any) => {
      try {
        // LiveKit transcription format: { participant, trackSid, segments }
        if (event?.segments && Array.isArray(event.segments)) {
          const text = event.segments
            .map((seg: any) => seg.text)
            .filter((t: string) => t)
            .join(' ');
          if (text.trim()) {
            // Check if it's from the agent (not user)
            const participant = event.participant;
            const localParticipant = (room as any)?.localParticipant;
            if (participant && participant !== localParticipant) {
              onMessage(text);
            }
          }
        } else if (event?.text) {
          onMessage(event.text);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Error handling transcription', err);
      }
    };
    
    // Try multiple ways to listen for events
    if (typeof (room as any).on === 'function') {
      (room as any).on('data_received', handleData);
      (room as any).on('transcription', handleTranscription);
      (room as any).on('transcriptionReceived', handleTranscription);
    }
    
    // Listen to remote participant events (agent is a remote participant)
    const setupParticipantListener = () => {
      const participants = (room as any)?.remoteParticipants;
      if (participants && typeof participants.forEach === 'function') {
        participants.forEach((participant: any) => {
          if (participant && typeof participant.on === 'function') {
            participant.on('data_received', handleData);
            participant.on('transcription', handleTranscription);
          }
        });
      }
      
      // Also listen for new participants joining
      if (typeof (room as any).on === 'function') {
        const handleParticipantConnected = (participant: any) => {
          if (participant && typeof participant.on === 'function') {
            participant.on('data_received', handleData);
            participant.on('transcription', handleTranscription);
          }
        };
        (room as any).on('participantConnected', handleParticipantConnected);
        
        return () => {
          if (typeof (room as any).off === 'function') {
            (room as any).off('participantConnected', handleParticipantConnected);
          }
        };
      }
    };
    
    const cleanupParticipant = setupParticipantListener();
    
    return () => {
      if (typeof (room as any).off === 'function') {
        (room as any).off('data_received', handleData);
        (room as any).off('transcription', handleTranscription);
        (room as any).off('transcriptionReceived', handleTranscription);
      }
      if (cleanupParticipant) cleanupParticipant();
    };
  }, [room, onMessage]);
  
  return null;
}