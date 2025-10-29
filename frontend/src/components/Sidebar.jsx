const items = [
  { key: 'Overview', icon: '🏠' },
  { key: 'Chat AI', icon: '💬' },
  { key: 'CRM', icon: '👥' },
  { key: 'Tickets', icon: '🎟️' },
  { key: 'Meetings', icon: '📆' },
  { key: 'Analytics', icon: '📊' },
  { key: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ active, onChange }) {
  return (
    <aside className="hidden md:block w-60 shrink-0 p-4 border-r border-[var(--border)]">
      <div className="text-xl font-bold mb-4">Voxa</div>
      <nav className="space-y-1">
        {items.map(({ key, icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`w-full text-left px-3 py-2 rounded transition ${active === key ? 'bg-[var(--primary)] text-white' : 'hover:bg-gray-100'}`}
          >
            <span className="mr-2">{icon}</span>
            {key}
          </button>
        ))}
      </nav>
    </aside>
  );
}


