import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listTickets, updateTicketStatus } from "@/lib/api";

const filters = ["All", "Open", "In Progress", "Resolved"] as const;

const Tickets = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const { data, isLoading } = useQuery({ queryKey: ["tickets"], queryFn: listTickets });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTicketStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const items = (data?.items || data || []).filter((t: any) => (filter === "All" ? true : t.status === filter));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
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
            <Card key={t.id} className="glass">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.priority}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <div>{t.description}</div>
                <div className="flex items-center gap-2">
                  <span>Status:</span>
                  <select
                    className="bg-transparent border rounded px-2 py-1"
                    value={t.status}
                    onChange={(e) => mutation.mutate({ id: t.id, status: e.target.value })}
                  >
                    {filters.filter((x) => x !== "All").map((s) => (
                      <option key={s} value={s}>
                        {s}
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
    </div>
  );
};

export default Tickets;


