const items = [
  { key: 'Overview', icon: '🏠' },
  { key: 'Chat AI', icon: '💬' },
  { key: 'CRM', icon: '👥' },
  { key: 'Tickets', icon: '🎟️' },
  { key: 'Settings', icon: '⚙️' },
];

export default function BottomNav({ active, onChange }) {
  return (
    <div className="fixed md:hidden bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-[var(--border)]">
      <div className="flex justify-around h-14 items-center">
        {items.map(({ key, icon }) => (
          <button key={key} onClick={() => onChange(key)} className={`text-sm ${active === key ? 'text-[var(--primary)]' : 'text-gray-600'}`}>
            <div className="text-lg leading-none">{icon}</div>
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}


