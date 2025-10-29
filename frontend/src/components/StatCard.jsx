export default function StatCard({ title, value, trend }) {
  return (
    <div className="p-4 rounded-xl card-glass fade-in">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {trend && <div className={`text-xs mt-1 ${trend.startsWith('+') ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{trend}</div>}
    </div>
  );
}


