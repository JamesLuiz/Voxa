import { useState } from "react";
import ChatInterface from "@/components/ChatInterface";
import voxaLogo from "@/assets/voxa-logo.png";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic } from "lucide-react";
import { useParams } from "react-router-dom";
import { customerChat, getLivekitToken } from "@/lib/api";
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
import { Track } from "livekit-client";

const CustomerChat = () => {
  const { businessId = "" } = useParams();
  const businessName = "Acme Corp";
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [livekitInfo, setLivekitInfo] = useState<{ token: string; serverUrl: string } | null>(null);

  const handleStartCall = async () => {
    setIsConnecting(true);
    try {
      const info = await getLivekitToken({ role: "customer", businessId });
      setLivekitInfo(info);
      // In a full implementation, connect to LiveKit using info.token and info.serverUrl or getCustomerRoomUrl
      // const roomUrl = getCustomerRoomUrl(businessId);
      setIsCallActive(true);
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
        <div className="w-full flex items-center justify-center gap-1 h-16">
          {audioTrack && <BarVisualizer barCount={10} trackRef={audioTrack} className="w-full" />}
        </div>
        <div className="mt-3 flex justify-center"><VoiceAssistantControlBar /></div>
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
        className="gap-3 mt-4"
        onClick={async () => {
          try { await room.disconnect(); } catch {}
          onEnded();
        }}
      >
        <PhoneOff className="w-6 h-6" />
        End Call
      </Button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="glass border-b border-border p-6">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <img src={voxaLogo} alt={businessName} className="w-14 h-14" />
          <div>
            <h1 className="text-2xl font-bold">{businessName}</h1>
            <p className="text-sm text-muted-foreground">AI Voice Assistant</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col lg:flex-row gap-6">
        {/* Voice Call Section */}
        <div className="flex-1 flex flex-col items-center justify-center glass rounded-3xl p-8">
          {!isCallActive ? (
            <div className="text-center space-y-8 animate-fade-in">
              <div className="w-32 h-32 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-16 h-16 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">Start Voice Call</h2>
                <p className="text-muted-foreground">
                  Talk to our AI assistant instantly
                </p>
              </div>
              <Button
                size="lg"
                className="gap-3 text-lg px-8 py-6 rounded-full"
                onClick={handleStartCall}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Phone className="w-6 h-6" />
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
                    style={{ height: 320 }}
                  >
                    <div className="h-full grid grid-rows-[1fr_auto]">
                      <div className="p-3">
                        <GridLayout tracks={[]}>
                          <ParticipantTile />
                        </GridLayout>
                      </div>
                      <div className="p-3 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-2">
                          <TrackToggle source={Track.Source.Microphone} />
                          <TrackToggle source={Track.Source.Camera} />
                        </div>
                        <div className="mt-3"><VoiceInline /></div>
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
        <div className="flex-1 flex flex-col">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Text Chat</h3>
            <p className="text-sm text-muted-foreground">
              Type your message and AI will respond with voice
            </p>
          </div>
          <div className="flex-1">
            <ChatInterface mode="customer" businessName={businessName} onSend={(text) => customerChat(businessId, text)} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Powered by <span className="text-primary font-semibold">Voxa</span>
        </p>
      </footer>
    </div>
  );
};

export default CustomerChat;
