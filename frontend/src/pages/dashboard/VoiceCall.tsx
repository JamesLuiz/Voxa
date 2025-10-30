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
    <div className="flex flex-col items-center gap-4 sm:gap-6 w-full">
      <div className="text-center">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Voice Assistant</h2>
        <p className="text-sm sm:text-base text-muted-foreground">{state === "listening" ? "Listening" : state === "speaking" ? "Speaking" : "Idle"}</p>
      </div>
      <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg h-16 sm:h-20 md:h-24 flex items-center justify-center">
        {audioTrack && (
          <BarVisualizer barCount={8} trackRef={audioTrack} className="w-full" />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
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
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm sm:text-base">Connecting to LiveKit...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] p-3 sm:p-4 md:p-6 flex items-center justify-center">
      <LiveKitRoom serverUrl={serverUrl} token={token} connect audio video style={{ height: "auto", width: "100%" }}>
        <div className="w-full max-w-4xl glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Realtime Voice Session</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Connected</p>
            </div>
            <EndButton onEnded={() => navigate(-1)} />
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-rows-[auto_1fr] sm:grid-rows-[1fr_auto]">
              <div className="p-2 sm:p-3 overflow-hidden min-h-[200px] sm:min-h-[250px]">
                <GridLayout tracks={[]}>
                  <ParticipantTile />
                </GridLayout>
              </div>
              <div className="p-3 sm:p-4 md:p-6 flex items-center justify-center">
                <VoiceUI />
              </div>
            </div>
          </div>
        </div>
      </LiveKitRoom>
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
      className="gap-2 w-full sm:w-auto text-sm sm:text-base"
    >
      <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
      End
    </Button>
  );
}