import { useEffect, useRef, useState } from 'react';

export default function ChatInterface({ mode = 'customer', businessContext = {}, onVoiceStart, onVoiceEnd, onTextSubmit }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = { id: Date.now(), role: 'user', text: input.trim(), ts: new Date().toISOString() };
    setMessages((m) => [...m, msg]);
    onTextSubmit && onTextSubmit(msg.text);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[75%] px-4 py-3 rounded-2xl ${m.role === 'user' ? 'ml-auto bg-[var(--primary)] text-white' : 'mr-auto bg-[var(--card-light)] dark:bg-[var(--card-dark)]'}`}>
            <div className="text-sm opacity-70 mb-1">{new Date(m.ts).toLocaleTimeString()}</div>
            <div>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-[var(--border)] flex items-center gap-2">
        <button onMouseDown={onVoiceStart} onMouseUp={onVoiceEnd} className="w-11 h-11 rounded-full text-white" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
          <span className="material-icons">mic</span>
        </button>
        <textarea
          className="flex-1 resize-none rounded-xl px-3 py-2 border outline-none focus:ring"
          rows={1}
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button onClick={handleSend} className="px-4 py-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
          Send
        </button>
      </div>
    </div>
  );
}


