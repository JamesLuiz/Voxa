import { useState, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import voxaLogo from "@/assets/voxa-logo.png";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic } from "lucide-react";
import { useParams } from "react-router-dom";
import { customerChat, ownerChat, getLivekitToken, upsertCustomer } from "@/lib/api";
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
const API_BASE = import.meta.env.VITE_API_URL ;


const CustomerChat = ({ role = 'customer' }: { role?: 'customer' | 'owner' }) => {
  const { slug = "" } = useParams();
  const [businessId, setBusinessId] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("Acme Corp");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [livekitInfo, setLivekitInfo] = useState<{ token: string; serverUrl: string } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(() => sessionStorage.getItem('customerId'));
  const [collectStep, setCollectStep] = useState<'none'|'name'|'email'|'phone'|'done'>('none');
  const [pendingCustomerInfo, setPendingCustomerInfo] = useState<{name?: string; email?: string; phone?: string}>({});

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
      return "Thank you. Please enter your email address.";
    } else if (collectStep === 'email') {
      const valid = /^\S+@\S+\.\S+$/.test(input.trim());
      if (!valid) return "That does not look like a valid email. Please enter a valid email address.";
      setPendingCustomerInfo((prev) => ({ ...prev, email: input.trim() }));
      setCollectStep('phone');
      return "Great. Now, please enter your phone number.";
    } else if (collectStep === 'phone') {
      // finalize pending info and upsert using collected values
      const finalInfo = { ...pendingCustomerInfo, phone: input.trim() };
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
        return "Thank you! A support ticket can now be created or continued.";
      } catch (err) {
        setCollectStep('none');
        return "Sorry, we could not save your info. Please try again later.";
      }
    }
    return "";
  }

  function getAiPromptForStep() {
    if (collectStep === 'name') return "Welcome! Please enter your full name to get started.";
    if (collectStep === 'email') return "Thank you. Please enter your email address.";
    if (collectStep === 'phone') return "Great. Now, please enter your phone number.";
    return null;
  }

  const handleStartCall = async () => {
    setIsConnecting(true);
    try {
      const info = await getLivekitToken({ role: role === 'owner' ? 'owner' : 'customer', businessId });
      setLivekitInfo(info);
      // In a full implementation, connect to LiveKit using info.token and info.serverUrl or getCustomerRoomUrl
      // const roomUrl = getCustomerRoomUrl(businessId);
      setIsCallActive(true);
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
      // noop: surface via toast in future
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEndCall = () => {
    setIsCallActive(false);
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
                      console.warn('could not unpublish/stop publication', err);
                    }
                  }
                } else if (local && (local.tracks instanceof Map || (local.tracks && typeof local.tracks.values === 'function'))) {
                  const vals = Array.from((local.tracks as Map<any, any>).values());
                  for (const t of vals) {
                    try {
                      if (t && typeof t.unpublish === 'function') try { await t.unpublish(); } catch {}
                      if (t && typeof (t as any).stop === 'function') try { (t as any).stop(); } catch {}
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.warn('could not unpublish/stop track', err);
                    }
                  }
                }
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('could not cleanup local participant tracks', err);
              }
            } else if (typeof room?.disconnect === 'function') {
              // fallback: disconnect if we have no local participant
              try { await room.disconnect(); } catch {}
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
                    serverUrl={livekitInfo.serverUrl || getCustomerRoomUrl(businessId)}
                    token={livekitInfo.token}
                    connect
                    audio
                    video
                    style={{ height: "auto", minHeight: 280 }}
                  >
                    <PublishPendingText />
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
                        <DisconnectButton onEnded={() => setIsCallActive(false)} />
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
            <ChatInterface mode={role === 'owner' ? 'owner' : 'customer'} businessName={businessName} onSend={async (text) => {
              if (role === 'owner') {
                const r = await ownerChat(text);
                return r || 'AI did not respond';
              }
              if (!customerId || collectStep !== 'done') {
                return await handleCustomerIdentityInput(text);
              }
              // after customerId is set, proceed to normal chat/ticket
              const result = await customerChat(businessId, text);
              return result || "AI did not respond";
            }} onStartVoice={() => handleStartCall()} />
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
    const pending = sessionStorage.getItem('voxa_pending_text');
    if (!pending) return;
    const lp: any = (room as any)?.localParticipant;
    const publishData = async () => {
      try {
        const enc = new TextEncoder().encode(pending);
        if (lp && typeof lp.publishData === 'function') {
          await lp.publishData(enc, DataPacket_Kind.RELIABLE);
          sessionStorage.removeItem('voxa_pending_text');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to publish pending text', err);
      }
    };

    if (lp && typeof lp.publishData === 'function') {
      publishData();
    } else if (room && typeof (room as any).once === 'function') {
      (room as any).once('connected', publishData);
    }
  }, [room]);
  return null;
}