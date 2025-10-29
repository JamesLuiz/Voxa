import { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import ChatInterface from '../components/ChatInterface';
import StatCard from '../components/StatCard';

const tabs = ['Overview', 'Chat AI', 'CRM', 'Tickets', 'Meetings', 'Analytics', 'Settings'];

export default function Dashboard() {
  const [active, setActive] = useState('Overview');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar active={active} onChange={setActive} />
        <main className="flex-1 p-4 md:p-6">
          {active === 'Overview' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <StatCard title="Customers" value="0" trend="+0%" />
                <StatCard title="Open Tickets" value="0" trend="0" />
                <StatCard title="Today's Meetings" value="0" trend="+0" />
              </div>
              <div className="card-glass p-4">
                <div className="font-semibold mb-3">Recent Activity</div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="slide-up">No recent activity yet.</div>
                </div>
              </div>
            </div>
          )}

          {active === 'Chat AI' && (
            <div className="h-[70vh] rounded-xl border border-[var(--border)] overflow-hidden">
              <ChatInterface mode="owner" />
            </div>
          )}

          {active === 'CRM' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input className="px-3 py-2 border rounded w-full" placeholder="Search customers" />
                <button className="px-3 py-2 rounded text-white btn-gradient">Add Customer</button>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="card-glass p-4">No customers yet.</div>
              </div>
            </div>
          )}

          {active === 'Tickets' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {['All', 'Open', 'In Progress', 'Resolved'].map(f => (
                  <button key={f} className="px-3 py-1.5 border rounded">{f}</button>
                ))}
              </div>
              <div className="card-glass p-4">No tickets yet.</div>
            </div>
          )}

          {active === 'Meetings' && (
            <div className="card-glass p-4">Calendar coming soon</div>
          )}

          {active === 'Analytics' && (
            <div className="card-glass p-4">Charts coming soon</div>
          )}

          {active === 'Settings' && (
            <div className="space-y-6">
              <div className="card-glass p-4">
                <div className="font-semibold mb-2">Business Info</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <input className="px-3 py-2 border rounded" placeholder="Description" />
                  <input className="px-3 py-2 border rounded" placeholder="Products (comma separated)" />
                </div>
              </div>
              <div className="card-glass p-4">
                <div className="font-semibold mb-2">AI Config</div>
                <div className="grid md:grid-cols-3 gap-3">
                  <select className="px-3 py-2 border rounded"><option>professional</option><option>casual</option><option>friendly</option></select>
                  <select className="px-3 py-2 border rounded"><option>concise</option><option>detailed</option></select>
                  <input className="px-3 py-2 border rounded" placeholder="Business hours (JSON)" />
                </div>
                <textarea className="mt-3 w-full px-3 py-2 border rounded" rows={3} placeholder="Custom prompt" />
              </div>
            </div>
          )}
        </main>
      </div>
      <BottomNav active={active} onChange={setActive} />
    </div>
  );
}


