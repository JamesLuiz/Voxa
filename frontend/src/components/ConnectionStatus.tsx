import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Loader2, CheckCircle2, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionStage = 
  | "idle" 
  | "call_started" 
  | "waiting_for_assistant" 
  | "agent_connected" 
  | "error";

interface ConnectionStatusProps {
  isCallActive: boolean;
  className?: string;
}

export function ConnectionStatus({ isCallActive, className }: ConnectionStatusProps) {
  const room = useRoomContext();
  const [stage, setStage] = useState<ConnectionStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasAgent, setHasAgent] = useState(false);

  useEffect(() => {
    if (!isCallActive) {
      setStage("idle");
      setHasAgent(false);
      return;
    }

    if (!room) {
      setStage("call_started");
      return;
    }

    // Stage 1: Call started
    setStage("call_started");
    setErrorMessage("");

    // Check room connection state
    const roomState = (room as any)?.state;
    if (roomState === "disconnected" || roomState === "reconnecting") {
      setStage("error");
      setErrorMessage("Connection lost. Please check your internet connection.");
      return;
    }

    // Stage 2: Waiting for assistant
    const checkForAgent = () => {
      try {
        const participants = Array.from((room as any)?.participants?.values() || []);
        const localParticipant = (room as any)?.localParticipant;
        const localIdentity = localParticipant?.identity || "";
        
        const remoteParticipants = participants.filter((p: any) => {
          const identity = p?.identity || "";
          return identity && identity !== localIdentity;
        });

        // Check if any remote participant is the agent
        // Agents typically:
        // 1. Have identity containing "agent" or similar
        // 2. OR have audio tracks published (agents publish audio)
        // 3. OR are any remote participant (if only one remote, likely the agent)
        const agentParticipant = remoteParticipants.find((p: any) => {
          const identity = (p?.identity || "").toLowerCase();
          
          // Check identity patterns
          if (identity.includes("agent") || identity.includes("assistant") || identity.includes("voxa")) {
            return true;
          }
          
          // Check if participant has audio tracks (agents publish audio)
          try {
            const tracks = Array.from((p as any)?.audioTrackPublications?.values() || []);
            if (tracks.length > 0) {
              return true;
            }
          } catch (e) {
            // Ignore errors checking tracks
          }
          
          return false;
        });

        // If we have remote participants, assume one is the agent
        // (In a typical call, there's the user and the agent)
        if (agentParticipant || remoteParticipants.length > 0) {
          setHasAgent(true);
          setStage("agent_connected");
        } else {
          setStage("waiting_for_assistant");
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Error checking for agent:", e);
      }
    };

    // Initial check
    checkForAgent();

    // Set up listeners
    const handleParticipantConnected = (participant: any) => {
      const localParticipant = (room as any)?.localParticipant;
      const localIdentity = localParticipant?.identity || "";
      const participantIdentity = participant?.identity || "";
      
      // Skip if this is the local participant
      if (participantIdentity === localIdentity) {
        return;
      }
      
      // Check if this participant is likely the agent
      const identity = participantIdentity.toLowerCase();
      const isAgent = 
        identity.includes("agent") || 
        identity.includes("assistant") || 
        identity.includes("voxa") ||
        // Check if participant has audio tracks (agents publish audio)
        (() => {
          try {
            const tracks = Array.from((participant as any)?.audioTrackPublications?.values() || []);
            return tracks.length > 0;
          } catch {
            return false;
          }
        })();
      
      if (isAgent) {
        setHasAgent(true);
        setStage("agent_connected");
      } else {
        // Re-check all participants
        checkForAgent();
      }
    };

    const handleParticipantDisconnected = () => {
      checkForAgent();
    };

    const handleConnected = () => {
      // Immediately check for agent when room connects
      // Use a small delay to ensure participants are fully loaded
      setTimeout(() => {
        checkForAgent();
      }, 500);
    };

    const handleDisconnected = (reason?: string) => {
      setStage("error");
      if (reason === "SERVER_SHUTDOWN") {
        setErrorMessage("Server is temporarily unavailable. Please try again in a moment.");
      } else if (reason === "NETWORK_ERROR") {
        setErrorMessage("Network error. Please check your internet connection.");
      } else {
        setErrorMessage("Connection lost. Please try reconnecting.");
      }
    };

    const handleReconnecting = () => {
      setStage("error");
      setErrorMessage("Reconnecting... Please wait.");
    };

    // Set timeout for waiting stage
    let timeoutId: NodeJS.Timeout;
    if (stage === "waiting_for_assistant") {
      timeoutId = setTimeout(() => {
        if (!hasAgent) {
          setStage("error");
          setErrorMessage("Assistant is taking longer than expected. Please check your connection or try again.");
        }
      }, 15000); // 15 second timeout
    }

    // Attach event listeners
    if (typeof (room as any)?.on === "function") {
      (room as any).on("participantConnected", handleParticipantConnected);
      (room as any).on("participantDisconnected", handleParticipantDisconnected);
      (room as any).on("connected", handleConnected);
      (room as any).on("disconnected", handleDisconnected);
      (room as any).on("reconnecting", handleReconnecting);
    }

    // Periodic check for agent (fallback) - check every second
    const intervalId = setInterval(checkForAgent, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      if (typeof (room as any)?.off === "function") {
        (room as any).off("participantConnected", handleParticipantConnected);
        (room as any).off("participantDisconnected", handleParticipantDisconnected);
        (room as any).off("connected", handleConnected);
        (room as any).off("disconnected", handleDisconnected);
        (room as any).off("reconnecting", handleReconnecting);
      }
    };
  }, [isCallActive, room, stage, hasAgent]);

  if (!isCallActive || stage === "idle") {
    return null;
  }

  const getStageConfig = () => {
    switch (stage) {
      case "call_started":
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: "Call started...",
          color: "text-primary",
          bgColor: "bg-primary/10",
        };
      case "waiting_for_assistant":
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: "Waiting for assistant to join...",
          color: "text-yellow-600 dark:text-yellow-400",
          bgColor: "bg-yellow-500/10",
        };
      case "agent_connected":
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          text: "Agent connected",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-500/10",
        };
      case "error":
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: errorMessage || "Connection error",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
        };
      default:
        return null;
    }
  };

  const config = getStageConfig();
  if (!config) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
        config.bgColor,
        config.color,
        className
      )}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}

