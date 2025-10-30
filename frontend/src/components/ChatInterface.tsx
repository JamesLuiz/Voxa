import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  mode: "owner" | "customer";
  businessName?: string;
  onSend?: (text: string) => Promise<string> | string; // optional backend integration
  onStartVoice?: () => void; // when mic is pressed (used for admin realtime voice)
}

const ChatInterface = ({ mode, businessName, onSend, onStartVoice }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: mode === "owner" 
        ? "Hello! I'm your Voxa AI assistant. How can I help you manage your business today?"
        : `Hi! I'm the AI assistant for ${businessName || "this business"}. How can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    try {
      let reply = "I understand your request. Let me help you with that.";
      if (onSend) {
        const result = await onSend(userMessage.content);
        if (typeof result === "string" && result) reply = result;
      }
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleRecording = () => {
    const next = !isRecording;
    setIsRecording(next);
    if (next && mode === "owner") {
      onStartVoice && onStartVoice();
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-xl sm:rounded-2xl overflow-hidden">
      {/* Chat messages */}
      <ScrollArea className="flex-1 p-3 sm:p-4 md:p-6">
        <div className="space-y-3 sm:space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-xl sm:rounded-2xl ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-primary to-accent text-white"
                    : "bg-muted/50"
                }`}
              >
                <p className="text-xs sm:text-sm break-words">{message.content}</p>
                <span className="text-[10px] sm:text-xs opacity-70 mt-1 sm:mt-2 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                <div className="flex gap-1.5 sm:gap-2">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 sm:p-4 md:p-6 border-t border-border">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Voice recording button */}
          <Button
            size="icon"
            variant={isRecording ? "default" : "outline"}
            onClick={toggleRecording}
            className={`flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 ${isRecording ? "animate-pulse-glow" : ""}`}
          >
            {isRecording ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
          </Button>

          {/* Text input */}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={isRecording ? "Recording..." : "Type a message..."}
            disabled={isRecording}
            className="flex-1 text-sm sm:text-base"
          />

          {/* Send button */}
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isRecording}
            className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10"
            size="icon"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>

        {/* Recording waveform */}
        {isRecording && (
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-3 sm:mt-4 h-8 sm:h-12">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 sm:w-1 bg-primary rounded-full animate-wave"
                style={{ 
                  animationDelay: `${i * 50}ms`,
                  height: "100%"
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;