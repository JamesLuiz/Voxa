import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listTickets, updateTicketStatus, assignTicket, addTicketNote, getAnalyticsSummary, createMeeting } from "@/lib/api.ts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

const filters = ["All", "Open", "In Progress", "Resolved", "Closed"] as const;
const uiToApiStatus: Record<string, "open" | "in-progress" | "resolved" | "closed"> = {
  "Open": "open",
  "In Progress": "in-progress",
  "Resolved": "resolved",
  "Closed": "closed",
};

const Tickets = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", filter],
    queryFn: () => listTickets(filter === "All" ? undefined : { status: uiToApiStatus[filter] }),
  });

  // Inline analytics (overview)
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('voxa_business_id') || undefined : undefined;
  const { data: analytics } = useQuery({ queryKey: ['analytics-mini', businessId], queryFn: () => getAnalyticsSummary(businessId) });
  const [aiSummary, setAiSummary] = useState<string>("");
  useEffect(() => {
    // Simple derived summary (placeholder for AI-generated summary)
    const onceKey = 'voxa_tickets_summary_shown';
    if (sessionStorage.getItem(onceKey)) return;
    const open = analytics?.tickets?.open ?? 0;
    const inprog = analytics?.tickets?.progress ?? 0;
    const resolved = analytics?.tickets?.resolved ?? 0;
    const msg = `Today: ${open} open, ${inprog} in-progress, ${resolved} resolved. Focus on high-priority open tickets first.`;
    setAiSummary(msg);
    sessionStorage.setItem(onceKey, '1');
  }, [analytics]);

  // Saved views localStorage
  const [views, setViews] = useState<string[]>(() => {
    try { const raw = localStorage.getItem('voxa_ticket_views'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const saveCurrentView = () => {
    const name = prompt('Name this view');
    if (!name) return;
    const next = Array.from(new Set([name, ...views]));
    setViews(next);
    try { localStorage.setItem('voxa_ticket_views', JSON.stringify(next)); } catch {}
  };

  // "My Open Tickets" quick filter (requires stored owner email)
  const ownerEmail = typeof window !== 'undefined' ? localStorage.getItem('voxa_owner_email') || '' : '';
  const [myOnly, setMyOnly] = useState(false);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTicketStatus(id, status as any),
    onSuccess: async (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      if (variables.status === 'in-progress' || variables.status === 'resolved') {
        const proceed = confirm('Create a follow-up meeting for this ticket?');
        if (proceed) {
          try {
            const title = `Follow-up for ticket ${variables.id}`;
            const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            await createMeeting({ title, startsAt, durationMins: 30, with: ownerEmail || '' });
            alert('Meeting scheduled.');
          } catch (e) {
            alert('Failed to schedule meeting');
          }
        }
      }
    },
  });

  const items = (data?.items || data || []).map((t: any) => ({ ...t, id: t.id || t._id }))
    .filter((t: any) => (filter === "All" ? true : t.status === uiToApiStatus[filter]))
    .filter((t: any) => (!myOnly || !ownerEmail ? true : (t.assignedTo || '').toLowerCase() === ownerEmail.toLowerCase()));

  // Detail drawer state
  const [active, setActive] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const assign = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => assignTicket(id, email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
  const addNoteMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => addTicketNote(id, note),
    onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: ["tickets"] }); },
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-4 sm:px-0">
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button 
            key={f} 
            variant={filter === f ? "default" : "outline"} 
            onClick={() => setFilter(f)}
            className="text-xs sm:text-sm px-3 py-2"
          >
            {f}
          </Button>
        ))}
        <Button variant={myOnly ? 'default' : 'outline'} className="text-xs sm:text-sm px-3 py-2" onClick={() => { setFilter('Open'); setMyOnly((v) => !v); }}>
          My Open Tickets
        </Button>
        <Button variant="outline" className="text-xs sm:text-sm px-3 py-2" onClick={saveCurrentView}>Save View</Button>
        {views.map(v => (
          <Button key={v} variant="outline" className="text-xs sm:text-sm px-3 py-2" onClick={() => { setFilter('Open'); setMyOnly(true); }}>
            {v}
          </Button>
        ))}
      </div>

      {/* Inline analytics mini */}
      {aiSummary && (
        <div className="text-xs sm:text-sm bg-accent/10 text-accent px-3 py-2 rounded">
          {aiSummary}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass"><CardContent className="p-3"><div className="text-xs text-muted-foreground">Open</div><div className="text-lg font-semibold">{analytics?.tickets?.open ?? 0}</div></CardContent></Card>
        <Card className="glass"><CardContent className="p-3"><div className="text-xs text-muted-foreground">In Progress</div><div className="text-lg font-semibold">{analytics?.tickets?.progress ?? 0}</div></CardContent></Card>
        <Card className="glass"><CardContent className="p-3"><div className="text-xs text-muted-foreground">Resolved</div><div className="text-lg font-semibold">{analytics?.tickets?.resolved ?? 0}</div></CardContent></Card>
        <Card className="glass"><CardContent className="p-3"><div className="text-xs text-muted-foreground">Customers</div><div className="text-lg font-semibold">{analytics?.customers?.total ?? 0}</div></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t: any) => (
            <Card key={t.id} className="glass cursor-pointer" onClick={() => setActive(t)}>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-base sm:text-lg break-words">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.priority}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <div className="break-words">{t.description}</div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span>Status:</span>
                  <select
                    className="bg-transparent border rounded px-2 py-1 w-full sm:w-auto"
                    value={t.status}
                    onChange={(e) => mutation.mutate({ id: t.id, status: e.target.value as any })}
                  >
                    {Object.values(uiToApiStatus).map((s) => (
                      <option key={s} value={s}>
                        {s.replace("in-progress", "In Progress").replace(/^./, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          ))}
          {!items.length && <div className="text-center text-muted-foreground py-10">No tickets</div>}
        </div>
      )}

      {/* Ticket detail drawer */}
      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.title || 'Ticket'}</DialogTitle>
            <DialogDescription>{active?.description}</DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground">Assigned to:</span>
                <input className="bg-transparent border rounded px-2 py-1 flex-1" defaultValue={active.assignedTo || ''} onBlur={(e) => e.target.value !== (active.assignedTo || '') && assign.mutate({ id: active.id, email: e.target.value })} />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground">Add note:</span>
                <input className="bg-transparent border rounded px-2 py-1 flex-1" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" onClick={() => note.trim() && addNoteMut.mutate({ id: active.id, note })}>Add</Button>
              </div>
              <div className="flex gap-2 items-center">
                <Button variant="outline" onClick={() => window.open(`mailto:${active.customerEmail || ''}`)}>Email customer</Button>
                <Button variant="outline" onClick={() => window.open(`mailto:${active.assignedTo || ownerEmail}`)}>Email assignee</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tickets;