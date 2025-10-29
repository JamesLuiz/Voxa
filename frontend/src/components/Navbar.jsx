export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <img src="/logo.svg" alt="logo" className="w-7 h-7" />
        <div className="font-semibold">Voxa</div>
        <div className="ml-auto flex items-center gap-3">
          <input className="hidden md:block px-3 py-1.5 border rounded-lg w-64" placeholder="Search..." />
          <button className="px-3 py-1.5 border rounded-lg">Theme</button>
          <div className="w-8 h-8 rounded-full bg-gray-200" />
        </div>
      </div>
    </header>
  );
}


