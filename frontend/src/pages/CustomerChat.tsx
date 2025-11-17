import { useState, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import voxaLogo from "@/assets/voxa-logo.png";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { customerChat, getLivekitToken, upsertCustomer, getLatestTicket, createTicketForEmail, getCustomerByEmail } from "@/lib/api.ts";
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


const CustomerChat = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [livekitInfo, setLivekitInfo] = useState<{ token: string; serverUrl: string } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(() => sessionStorage.getItem('customerId'));
  const [currentUserName, setCurrentUserName] = useState<string | undefined>(undefined);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined);
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
    // On mount, if no customerId, start collecting info
    if (!customerId) setCollectStep('name');
  }, [customerId, slug]);

  async function handleCustomerIdentityInput(input: string): Promise<string> {
    if (collectStep === 'name') {
      setPendingCustomerInfo((prev) => ({ ...prev, name: input.trim() }));
      setCollectStep('email');
      return "Thanks! Could you share your email address? You'll get updates there.";
    } else if (collectStep === 'email') {
      const valid = /^\S+@\S+\.\S+$/.test(input.trim());
      if (!valid) return "Hmm, that email doesn't look right. Try again (example: you@site.com).";
      setPendingCustomerInfo((prev) => ({ ...prev, email: input.trim() }));
      setCollectStep('phone');
      return "Optional: Share your phone number, or type 'skip'.";
    } else if (collectStep === 'phone') {
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
              const t = await getLatestTicket(businessId, finalInfo.email);
              if (t && (t._id || t.id)) {
                setTicketBanner({ id: String(t._id || t.id) });
              }
            }
          }
        } catch {}
        return "You're all set! I've saved your details and opened a support ticket.";
      } catch (err) {
        setCollectStep('none');
        return "Sorry, we could not save your info. Please try again later.";
      }
    }
    return "";
  }

  function getAiPromptForStep() {
    if (collectStep === 'name') return "Welcome! What's your name?";
    if (collectStep === 'email') return "Great, what's your email? I'll use it for updates.";
    if (collectStep === 'phone') return "Phone is optional. You can enter it now or type 'skip'.";
    return null;
  }

  const handleStartCall = async () => {
    setIsConnecting(true);
    try {
      let userName: string | undefined = undefined;
      let userEmail: string | undefined = undefined;
      
      // For customers: Get email from sessionStorage or pendingCustomerInfo, then fetch from backend
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
          // eslint-disable-next-line no-console
          console.warn('[CustomerChat] Failed to fetch customer from DB:', err);
        }
      }

      const getOrCreateSessionId = () => {
        try {
          let sid = sessionStorage.getItem('voxa_session_id');
          if (!sid) {
            sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            sessionStorage.setItem('voxa_session_id', sid);
            sessionStorage.setItem('voxa_session_timestamp', String(Date.now()));
          }
          return sid;
        } catch {
          return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }
      };

      const sessionId = getOrCreateSessionId();

      setCurrentUserName(userName);
      setCurrentUserEmail(userEmail);

      const info = await getLivekitToken({
        role: 'customer',
        businessId,
        userName,
        userEmail,
        sessionId,
        metadata: {
          userRole: 'customer',
          businessId,
          slug: slug || '', // Pass slug in metadata for early resolution
          userName: userName || 'Guest',
          userEmail: userEmail || '',
          sessionId,
          timestamp: Date.now(),
        },
      });
      
      setLivekitInfo(null);
      setIsCallActive(false);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setLivekitInfo(info);
      setIsCallActive(true);
      setErrorBanner("");
      try { localStorage.setItem('voxa_last_session', JSON.stringify({ role: 'customer', businessId })); } catch {}
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
    setIsCallActive(false);
    setLivekitInfo(null);
    try {
      sessionStorage.removeItem('voxa_call_active');
      sessionStorage.removeItem('voxa_pending_text');
    } catch (e) {
      // ignore
    }
    // Automatically refresh the page after a short delay to allow cleanup
    setTimeout(() => {
      window.location.reload();
    }, 500);
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
                if (typeof local.getTrackPublications === 'function') {
                  const pubs: any[] = Array.from(local.getTrackPublications() as Iterable<any>);
                  for (const p of pubs) {
                    try {
                      if (p && typeof p.unpublish === 'function') {
                        try { await p.unpublish(); } catch {}
                      }
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
      <header className="glass border-b border-border p-4 sm:p-6">
        <div className="max-w-6xl mx-auto flex items-center gap-3 sm:gap-4">
          <img src={voxaLogo} alt={businessName} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{businessName}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Voice Assistant</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 md:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="flex-1 flex flex-col items-center justify-center glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
          {!isCallActive ? (
            <div className="text-center space-y-4 sm:space-y-6 md:space-y-8 animate-fade-in">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-primary" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Start Voice Call</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Talk to our assistant instantly
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
                      // eslint-disable-next-line no-console
                      console.log('Room disconnected:', reason);
                      setIsCallActive(false);
                      setLivekitInfo(null);
                      try {
                        sessionStorage.removeItem('voxa_call_active');
                        sessionStorage.removeItem('voxa_pending_text');
                      } catch (e) {
                        // ignore
                      }
                    }}
                  >
                    <RoleContextAnnouncer 
                      role="customer" 
                      businessId={businessId} 
                      slug={slug}
                      userName={currentUserName} 
                      userEmail={currentUserEmail} 
                    />
                    <PublishPendingText />
                    <AgentChatListener onMessage={(msg) => {
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

        <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0">
          <div className="mb-3 sm:mb-4">
            <h3 className="text-lg sm:text-xl font-bold">Text Chat</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Type your message and AI will respond with voice
            </p>
          </div>
          <div className="flex-1">
            <ChatInterface 
              mode="customer" 
              businessName={businessName} 
              onSend={async (text) => {
                const isCallActive = sessionStorage.getItem('voxa_call_active');
                if (isCallActive) {
                  return '';
                }
                await handleStartCall();
                return '';
              }} 
              onStartVoice={() => handleStartCall()} 
            />
          </div>
        </div>
      </main>

      <footer className="glass border-t border-border p-3 sm:p-4 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Powered by <span className="text-primary font-semibold">Voxa</span>
        </p>
      </footer>
    </div>
  );
};

export default CustomerChat;

function RoleContextAnnouncer({ role, businessId, slug, userName, userEmail }: { role: 'customer'; businessId?: string; slug?: string; userName?: string; userEmail?: string }) {
  const room = useRoomContext();
  useEffect(() => {
    if (!room) return;

    let sent = false;
    const announce = async () => {
      try {
        if (!room || (room as any)?.state !== 'connected') return;
        if (sent) return;
        const lp = (room as any)?.localParticipant as any;
        if (!lp) return;
        const payload = {
          type: 'role_context',
          context: {
            role,
            businessId: businessId || '',
            slug: slug || '',
            userName: userName || 'Guest',
            userEmail: userEmail || '',
            sessionId: sessionStorage.getItem('voxa_session_id') || '',
          }
        };
        const json = JSON.stringify(payload);
        if (typeof lp.sendText === 'function') {
          await lp.sendText(json, { topic: 'lk.chat' });
        } else if (typeof lp.publishData === 'function') {
          const enc = new TextEncoder().encode(json);
          await lp.publishData(enc, DataPacket_Kind.RELIABLE);
        }
        sent = true;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to announce role context', e);
      }
    };

    const maybeAnnounce = () => {
      if (room && (room as any)?.state === 'connected') announce();
    };

    if (typeof (room as any).on === 'function') {
      (room as any).on('connected', maybeAnnounce);
      (room as any).on('reconnected', maybeAnnounce);
    }
    maybeAnnounce();

    return () => {
      if (typeof (room as any).off === 'function') {
        (room as any).off('connected', maybeAnnounce);
        (room as any).off('reconnected', maybeAnnounce);
      }
    };
  }, [room, role, businessId, slug, userName, userEmail]);

  return null;
}

function PublishPendingText() {
  const room = useRoomContext();
  useEffect(() => {
    let active = true;
    let lastPublished = '';
    let connectionCheckInterval: NodeJS.Timeout | null = null;

    const publishIfPending = async () => {
      try {
        if (!room || (room as any)?.state !== 'connected') {
          return;
        }
        
        const pending = sessionStorage.getItem('voxa_pending_text');
        if (!pending || pending === lastPublished) return;
        
        const lp = (room as any)?.localParticipant as LocalParticipant | undefined;
        if (!lp) {
          return;
        }
        
        if (room && (room as any)?.state !== 'connected') {
          return;
        }
        
        const sendTextMessage = async () => {
          try {
            let textMessage = '';
            try {
              const parsed = JSON.parse(pending);
              if (parsed && parsed.type === 'text_message' && parsed.text) {
                textMessage = parsed.text;
              } else if (typeof parsed === 'string') {
                textMessage = parsed;
              }
            } catch {
              textMessage = pending;
            }
            
            if (!textMessage.trim()) {
              return;
            }
            
            if (typeof (lp as any).sendText === 'function') {
              await (lp as any).sendText(textMessage, { topic: 'lk.chat' });
            } else if (typeof (lp as any).publishData === 'function') {
              const message = JSON.stringify({
                type: 'text_message',
                text: textMessage,
                topic: 'lk.chat'
              });
              const enc = new TextEncoder().encode(message);
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

    const markCallActive = () => {
      if (room && (room as any)?.state === 'connected') {
        sessionStorage.setItem('voxa_call_active', '1');
      }
    };

    const handleConnected = () => {
      markCallActive();
      publishIfPending();
    };

    const handleDisconnected = () => {
      sessionStorage.removeItem('voxa_call_active');
      sessionStorage.removeItem('voxa_pending_text');
      active = false;
    };

    if (room && typeof (room as any).on === 'function') {
      (room as any).on('connected', handleConnected);
      (room as any).on('disconnected', handleDisconnected);
      (room as any).on('reconnecting', () => {
        sessionStorage.setItem('voxa_call_active', '1');
      });
      (room as any).on('reconnected', handleConnected);
    }

    if (room) {
      connectionCheckInterval = setInterval(() => {
        if (room && (room as any)?.state === 'connected') {
          markCallActive();
        } else {
          sessionStorage.removeItem('voxa_call_active');
        }
      }, 1000);
    }

    if (room && (room as any)?.state === 'connected') {
      markCallActive();
      publishIfPending();
    }

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
    
    const interval = setInterval(() => {
      if (active && room && (room as any)?.state === 'connected') {
        publishIfPending();
      }
    }, 200);

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
    
    const handleData = (payload: any) => {
      try {
        let text = '';
        let data: any = payload;
        
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
    
    const handleTranscription = (event: any) => {
      try {
        if (event?.segments && Array.isArray(event.segments)) {
          const text = event.segments
            .map((seg: any) => seg.text)
            .filter((t: string) => t)
            .join(' ');
          if (text.trim()) {
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
    
    if (typeof (room as any).on === 'function') {
      (room as any).on('data_received', handleData);
      (room as any).on('transcription', handleTranscription);
      (room as any).on('transcriptionReceived', handleTranscription);
    }
    
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
