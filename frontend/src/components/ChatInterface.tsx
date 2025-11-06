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
  mode: "owner" | "customer" | "general";
  businessName?: string;
  onSend?: (text: string) => Promise<string> | string; // optional backend integration
  onStartVoice?: () => void; // when mic is pressed (used for admin realtime voice)
}

const ChatInterface = ({ mode, businessName, onSend, onStartVoice }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for welcome message when component mounts (if call is active)
  useEffect(() => {
    const checkForWelcome = () => {
      const isCallActive = sessionStorage.getItem('voxa_call_active');
      // If no messages yet and call is active, welcome message should come via AgentChatListener
      // This is handled by the AgentChatListener component in CustomerChat.tsx
    };
    checkForWelcome();
  }, []);

  // Listen for agent messages from LiveKit
  useEffect(() => {
    const handleAgentMessage = (event: CustomEvent) => {
      const text = event.detail;
      if (text && typeof text === 'string') {
        const aiMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    };

    window.addEventListener('voxa-agent-message', handleAgentMessage as EventListener);
    return () => {
      window.removeEventListener('voxa-agent-message', handleAgentMessage as EventListener);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input;
    setInput("");
    setIsTyping(true);
    try {
      // If a call is active, send text via LiveKit data channel directly
      const isCallActive = sessionStorage.getItem('voxa_call_active');
      if (isCallActive) {
        // Store in sessionStorage for PublishPendingText to send immediately
        sessionStorage.setItem('voxa_pending_text', JSON.stringify({
          type: 'text_message',
          text: messageText
        }));
        // Trigger publish immediately via custom event (works in same window)
        sessionStorage.setItem('voxa_publish_trigger', Date.now().toString());
        window.dispatchEvent(new CustomEvent('voxa-publish-text', {
          detail: { timestamp: Date.now() }
        }));
        // Don't call onSend for active calls - agent will respond via voice/text in real-time
        return;
      }
      
      // Only call onSend if call is not active (fallback)
      if (onSend && !isCallActive) {
        const result = await onSend(messageText);
        if (result) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: result,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
      }
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
    <div className="flex flex-col h-full glass rounded-xl sm:rounded-2xl overflow-hidden border-2 border-primary/20">
      {/* Chat messages */}
      <ScrollArea className="flex-1 p-3 sm:p-4 md:p-6">
        <div className="space-y-3 sm:space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all duration-300 hover:scale-[1.02] ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg neon-glow"
                    : "bg-gradient-to-br from-muted/60 to-muted/40 backdrop-blur-xl border border-primary/10"
                }`}
              >
                <p className="text-xs sm:text-sm break-words leading-relaxed">{message.content}</p>
                <span className="text-[10px] sm:text-xs opacity-60 mt-1 sm:mt-2 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-gradient-to-br from-muted/60 to-muted/40 backdrop-blur-xl border border-primary/10 p-4 sm:p-5 rounded-2xl sm:rounded-3xl">
                <div className="flex gap-1.5 sm:gap-2 items-center">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-lg shadow-primary/50" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce shadow-lg shadow-accent/50" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-lg shadow-primary/50" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 sm:p-4 md:p-6 border-t border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Text input */}
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder={isRecording ? "Recording..." : "Type your message..."}
              disabled={isRecording}
              className="flex-1 text-sm sm:text-base h-11 sm:h-12 bg-muted/50 border-primary/20 focus:border-primary/40 transition-all pr-12 rounded-full"
            />
            {input.trim() && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                ⏎
              </div>
            )}
          </div>

          {/* Send button */}
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isRecording}
            className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full neon-glow transition-all hover:scale-110"
            size="icon"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>

        {/* Recording waveform */}
        {isRecording && (
          <div className="flex items-center justify-center gap-1 mt-4 h-10 sm:h-14">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-primary to-accent rounded-full animate-wave shadow-lg shadow-primary/50"
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