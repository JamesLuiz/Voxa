import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PhoneOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getLivekitToken } from "@/lib/api";
import { getOwnerRoomUrl } from "@/lib/livekit";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
  GridLayout,
  ParticipantTile,
  TrackToggle,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";

type LocationState = { token?: string; serverUrl?: string };

function VoiceUI() {
  const { state, audioTrack } = useVoiceAssistant();
  const room = useRoomContext();
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Voice Assistant</h2>
        <p className="text-muted-foreground">{state === "listening" ? "Listening" : state === "speaking" ? "Speaking" : "Idle"}</p>
      </div>
      <div className="w-72 h-24 flex items-center justify-center">
        {audioTrack && (
          <BarVisualizer barCount={8} trackRef={audioTrack} className="w-full" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <TrackToggle source={Track.Source.Microphone} />
        <TrackToggle source={Track.Source.Camera} />
        <VoiceAssistantControlBar />
      </div>
      <RoomAudioRenderer />
    </div>
  );
}

const VoiceCall = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const preset = (location.state || {}) as LocationState;
  const [token, setToken] = useState<string | null>(preset.token || null);
  const [serverUrl, setServerUrl] = useState<string | null>(preset.serverUrl || null);
  const [loading, setLoading] = useState<boolean>(!preset.token);

  useEffect(() => {
    let mounted = true;
    if (!token) {
      (async () => {
        try {
          const info = await getLivekitToken({ role: "owner" });
          if (!mounted) return;
          setToken(info.token);
          setServerUrl(info.serverUrl || getOwnerRoomUrl());
        } catch (e) {
          // eslint-disable-next-line no-alert
          alert("Unable to obtain LiveKit token");
          navigate(-1);
        } finally {
          if (mounted) setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [token, navigate]);

  if (loading || !serverUrl || !token) {
    return (
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Connecting to LiveKit...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] p-4">
      <div className="max-w-4xl mx-auto glass rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Realtime Voice Session</h2>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
          <EndButton onEnded={() => navigate(-1)} />
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect
            audio
            video
            style={{ height: 420 }}
          >
            <div className="h-full grid grid-rows-[1fr_auto]">
              <div className="p-3 overflow-hidden">
                <GridLayout tracks={[]}>
                  <ParticipantTile />
                </GridLayout>
              </div>
              <div className="p-3 flex items-center justify-center">
                <VoiceUI />
              </div>
            </div>
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
};

export default VoiceCall;

function EndButton({ onEnded }: { onEnded: () => void }) {
  const room = useRoomContext();
  return (
    <Button
      variant="destructive"
      onClick={async () => {
        try { await room.disconnect(); } catch {}
        onEnded();
      }}
      className="gap-2"
    >
      <PhoneOff className="w-5 h-5" />
      End
    </Button>
  );
}


