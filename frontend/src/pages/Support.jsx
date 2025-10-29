import ChatInterface from '../components/ChatInterface';

export default function Support() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b border-[var(--border)] flex items-center gap-3 bg-white/80 backdrop-blur">
        <img src="/logo.svg" alt="logo" className="w-8 h-8" />
        <div className="font-semibold">Business Name</div>
        <a href="/voice?role=customer" className="ml-auto px-3 py-2 rounded text-white btn-gradient">Start Voice Chat</a>
      </header>
      <main className="flex-1">
        <div className="h-[calc(100vh-64px-56px)] md:h-[calc(100vh-64px)]">
          <ChatInterface mode="customer" />
        </div>
      </main>
      <footer className="p-3 border-t border-[var(--border)] flex gap-2 justify-center bg-white/80 backdrop-blur md:sticky md:bottom-0">
        <button className="px-3 py-2 border rounded">Create Ticket</button>
        <button className="px-3 py-2 border rounded">Schedule Meeting</button>
        <button className="px-3 py-2 border rounded">My Tickets</button>
      </footer>
    </div>
  );
}


