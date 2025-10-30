import ChatInterface from "@/components/ChatInterface";
import { ownerChat } from "@/lib/api";
import { getOwnerRoomUrl } from "@/lib/livekit";
import { useNavigate } from "react-router-dom";
import { getLivekitToken } from "@/lib/api";

const ChatAI = () => {
  const navigate = useNavigate();

  const startVoice = async () => {
    try {
      const info = await getLivekitToken({ role: "owner" });
      const wsUrl = info.serverUrl || getOwnerRoomUrl();
      navigate("/dashboard/voice", { state: { token: info.token, serverUrl: wsUrl } });
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("Unable to start voice session");
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-6rem)] animate-fade-in px-4 sm:px-0">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Chat AI Assistant
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Use voice or text to interact with your AI assistant
        </p>
      </div>
      <div className="h-[calc(100%-4rem)] sm:h-[calc(100%-5rem)]">
        <ChatInterface mode="owner" onSend={(text) => ownerChat(text)} onStartVoice={startVoice} />
      </div>
    </div>
  );
};

export default ChatAI;