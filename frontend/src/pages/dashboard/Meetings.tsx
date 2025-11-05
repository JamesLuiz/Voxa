import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMeetings, createMeeting } from "@/lib/api.ts";

const Meetings = () => {
  const qc = useQueryClient();
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('voxa_business_id') || undefined : undefined;
  const [date, setDate] = useState("");
  const { data, isLoading, error } = useQuery({ 
    queryKey: ["meetings", businessId, date], 
    queryFn: () => listMeetings(date ? { from: date } : undefined),
    enabled: !!businessId, // Only fetch if businessId exists
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const [form, setForm] = useState({ title: "", startsAt: "", with: "" });
  const mutation = useMutation({
    mutationFn: () => createMeeting(form),
    onSuccess: () => {
      setForm({ title: "", startsAt: "", with: "" });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.refetchQueries({ queryKey: ["meetings", businessId] });
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-4 sm:px-0">
      <div className="flex flex-col gap-3">
        <Input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)}
          className="w-full"
        />
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Input 
            placeholder="Title" 
            value={form.title} 
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full"
          />
          <Input 
            type="datetime-local" 
            value={form.startsAt} 
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            className="w-full"
          />
          <Input 
            placeholder="With" 
            value={form.with} 
            onChange={(e) => setForm({ ...form, with: e.target.value })}
            className="w-full"
          />
          <Button 
            disabled={!form.title || !form.startsAt} 
            onClick={() => mutation.mutate()}
            className="w-full sm:w-auto whitespace-nowrap"
          >
            Schedule
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass h-28" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center p-8 text-muted-foreground">
          <p>Error loading meetings: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      ) : !data || (Array.isArray(data) && data.length === 0) ? (
        <div className="text-center p-8 text-muted-foreground">
          <p>No meetings scheduled yet. Create one above to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(Array.isArray(data) ? data : []).map((m: any) => {
            // Backend now provides normalized data with id, startsAt, and with fields
            const meetingId = m.id || m._id || `meeting-${Math.random()}`;
            const startTime = m.startsAt || m.startTime;
            
            // Format date safely
            let formattedDate = "TBD";
            try {
              if (startTime) {
                const date = new Date(startTime);
                if (!isNaN(date.getTime())) {
                  formattedDate = date.toLocaleString();
                }
              }
            } catch (e) {
              formattedDate = "Invalid Date";
            }
            
            return (
              <Card key={meetingId} className="glass">
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <span className="text-base sm:text-lg break-words">{m.title || "Untitled Meeting"}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formattedDate}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div>With: {m.with || "N/A"}</div>
                  {m.duration && <div className="mt-1">Duration: {m.duration} minutes</div>}
                  {m.status && <div className="mt-1 capitalize">Status: {m.status}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Meetings;