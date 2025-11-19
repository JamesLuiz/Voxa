import { useState, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import voxaLogo from "@/assets/voxa-logo.png";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import { getLivekitToken, getGeneralUserByEmail } from "@/lib/api.ts";
import { getGeneralRoomUrl } from "@/lib/livekit";
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


const GeneralChat = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [livekitInfo, setLivekitInfo] = useState<{ token: string; serverUrl: string } | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | undefined>(undefined);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined);
  const [errorBanner, setErrorBanner] = useState<string>("");
  const [reconnectOffer, setReconnectOffer] = useState<boolean>(false);
  const [callStage, setCallStage] = useState<'idle' | 'starting' | 'waiting' | 'connected' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleStartCall = async () => {
    setIsConnecting(true);
    setCallStage('starting');
    setConnectionError(null);
    setErrorBanner("");
    try {
      let userName: string | undefined = undefined;
      let userEmail: string | undefined = undefined;
      
      // For general users: Get email from localStorage, then fetch from backend
      const gu = localStorage.getItem('voxa_general_user');
      let emailToFetch: string | undefined = undefined;
      
      if (gu) {
        try {
          const parsed = JSON.parse(gu);
          emailToFetch = parsed?.email || undefined;
          userName = parsed?.name || undefined;
        } catch (_) {}
      }
      
      if (emailToFetch) {
        try {
          const generalUserData = await getGeneralUserByEmail(emailToFetch);
          if (generalUserData) {
            userName = generalUserData.name || userName;
            userEmail = generalUserData.email || emailToFetch;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[GeneralChat] Failed to fetch general user from DB:', err);
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
        role: 'general',
        userName,
        userEmail,
        sessionId,
        metadata: {
          userRole: 'general',
          userName: userName || 'Guest',
          userEmail: userEmail || '',
          sessionId,
          timestamp: Date.now(),
        },
      });
      
      setLivekitInfo(null);
      setIsCallActive(false);
      setCallStage('waiting');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setLivekitInfo(info);
      setIsCallActive(true);
      setErrorBanner("");
      try { localStorage.setItem('voxa_last_session', JSON.stringify({ role: 'general' })); } catch {}
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to start call:', e);
      setIsCallActive(false);
      setLivekitInfo(null);
      setCallStage('error');
      const errorMsg = e instanceof Error ? e.message : 'Could not start the call. Check your connection and try again.';
      setConnectionError(errorMsg);
      setErrorBanner(errorMsg);
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
      {errorBanner && (
        <div className="bg-destructive/10 text-destructive text-xs sm:text-sm px-3 py-2 text-center">{errorBanner} <button className="underline" onClick={handleStartCall}>Retry</button></div>
      )}
      <header className="glass border-b border-border p-4 sm:p-6">
        <div className="max-w-6xl mx-auto flex items-center gap-3 sm:gap-4">
          <img src={voxaLogo} alt="Voxa" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Voxa Assistant</h1>
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
                  Talk to your AI assistant
                </p>
              </div>
              {callStage === 'waiting' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-sm font-medium">Waiting for assistant to join...</span>
                  </div>
                </div>
              )}
              {callStage === 'error' && connectionError && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                  <p className="font-medium">Connection Error</p>
                  <p className="text-xs mt-1">{connectionError}</p>
                </div>
              )}
              <Button
                size="lg"
                className="gap-2 sm:gap-3 text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 rounded-full w-full sm:w-auto"
                onClick={handleStartCall}
                disabled={isConnecting || callStage === 'waiting'}
              >
                {isConnecting || callStage === 'waiting' ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {callStage === 'waiting' ? 'Waiting for assistant...' : 'Connecting...'}
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
              {callStage === 'connected' && (
                <div className="mb-2 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-3 py-1.5 rounded-full">
                    <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
                    <span className="font-medium">Agent Connected</span>
                  </div>
                </div>
              )}
              {livekitInfo && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <LiveKitRoom
                    key={`room-${livekitInfo.token.slice(-10)}`}
                    serverUrl={livekitInfo.serverUrl || getGeneralRoomUrl()}
                    token={livekitInfo.token}
                    connect
                    audio
                    video
                    style={{ height: "auto", minHeight: 280 }}
                    onConnected={() => {
                      setCallStage('connected');
                      setConnectionError(null);
                    }}
                    onDisconnected={(reason) => {
                      // eslint-disable-next-line no-console
                      console.log('Room disconnected:', reason);
                      setIsCallActive(false);
                      setLivekitInfo(null);
                      setCallStage('idle');
                      try {
                        sessionStorage.removeItem('voxa_call_active');
                        sessionStorage.removeItem('voxa_pending_text');
                      } catch (e) {
                        // ignore
                      }
                    }}
                    onError={(error) => {
                      // eslint-disable-next-line no-console
                      console.error('LiveKit room error:', error);
                      setCallStage('error');
                      setConnectionError(error?.message || 'Connection error occurred');
                      setErrorBanner(error?.message || 'Connection error occurred');
                    }}
                  >
                    <RoleContextAnnouncer 
                      role="general" 
                      userName={currentUserName} 
                      userEmail={currentUserEmail} 
                    />
                    <AgentPresenceDetector onAgentConnected={() => setCallStage('connected')} />
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
              mode="general" 
              businessName="Voxa" 
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

export default GeneralChat;

function RoleContextAnnouncer({ role, userName, userEmail }: { role: 'general'; userName?: string; userEmail?: string }) {
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
  }, [room, role, userName, userEmail]);

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

function AgentPresenceDetector({ onAgentConnected }: { onAgentConnected: () => void }) {
  const room = useRoomContext();
  const [agentDetected, setAgentDetected] = useState(false);
  
  useEffect(() => {
    if (!room || agentDetected) return;
    
    const checkForAgent = () => {
      try {
        // Check for agent participant (usually has 'agent' in identity)
        const participants = (room as any)?.remoteParticipants || (room as any)?.participants;
        if (participants) {
          const participantsMap = participants instanceof Map ? participants : new Map(Object.entries(participants || {}));
          for (const [id, participant] of participantsMap.entries()) {
            const identity = (participant as any)?.identity || '';
            // Agent typically has 'agent' in identity or is the local participant's counterpart
            if (identity && 'agent' in identity.toLowerCase()) {
              if (!agentDetected) {
                setAgentDetected(true);
                onAgentConnected();
                // eslint-disable-next-line no-console
                console.log('Agent detected in room:', identity);
              }
              return;
            }
          }
        }
        
        // Also check local participant's tracks - if agent is publishing, we'll see it
        const localParticipant = (room as any)?.localParticipant;
        if (localParticipant) {
          // Check if we're receiving audio/video from agent
          const tracks = (localParticipant as any)?.trackPublications || [];
          if (Array.isArray(tracks) && tracks.length > 0) {
            // If we have tracks, agent might be connected
            // This is a fallback detection method
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Error checking for agent:', err);
      }
    };
    
    // Check immediately
    checkForAgent();
    
    // Set up listeners for participant connections
    const handleParticipantConnected = (participant: any) => {
      const identity = (participant as any)?.identity || '';
      if (identity && 'agent' in identity.toLowerCase()) {
        if (!agentDetected) {
          setAgentDetected(true);
          onAgentConnected();
          // eslint-disable-next-line no-console
          console.log('Agent connected:', identity);
        }
      }
    };
    
    // Listen for participant connections
    if (typeof (room as any).on === 'function') {
      (room as any).on('participantConnected', handleParticipantConnected);
      (room as any).on('trackSubscribed', () => {
        // When a track is subscribed, it might be from the agent
        setTimeout(checkForAgent, 500);
      });
    }
    
    // Periodic check as fallback
    const interval = setInterval(checkForAgent, 2000);
    
    return () => {
      clearInterval(interval);
      if (typeof (room as any).off === 'function') {
        (room as any).off('participantConnected', handleParticipantConnected);
      }
    };
  }, [room, agentDetected, onAgentConnected]);
  
  return null;
}

