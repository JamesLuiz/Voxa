import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMeetings, createMeeting } from "@/lib/api";

const Meetings = () => {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["meetings", date], queryFn: () => listMeetings(date ? { from: date } : undefined) });
  const [form, setForm] = useState({ title: "", startsAt: "", with: "" });
  const mutation = useMutation({
    mutationFn: () => createMeeting(form),
    onSuccess: () => {
      setForm({ title: "", startsAt: "", with: "" });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex gap-2 w-full md:w-auto">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <Input placeholder="With" value={form.with} onChange={(e) => setForm({ ...form, with: e.target.value })} />
          <Button disabled={!form.title || !form.startsAt} onClick={() => mutation.mutate()}>Schedule</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items || data || []).map((m: any) => (
            <Card key={m.id} className="glass">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{m.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(m.startsAt).toLocaleString()}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                With: {m.with || "N/A"}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Meetings;


