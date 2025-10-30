import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSummary } from "@/lib/api";

const Analytics = () => {
  const { data, isLoading } = useQuery({ queryKey: ["analytics", "summary"], queryFn: getAnalyticsSummary });

  const summary = data || { tickets: { open: 0, progress: 0, resolved: 0 }, customers: { total: 0 }, queries: [] };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass"><CardHeader><CardTitle>Customers</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{summary.customers?.total ?? 0}</CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle>Open Tickets</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{summary.tickets?.open ?? 0}</CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle>In Progress</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{summary.tickets?.progress ?? 0}</CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle>Resolved</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{summary.tickets?.resolved ?? 0}</CardContent></Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass h-64" />
          <Card className="glass h-64" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass">
            <CardHeader><CardTitle>Ticket Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Use your chart library here (donut)</div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader><CardTitle>Customer Growth</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Use your chart library here (line)</div>
            </CardContent>
          </Card>
          <Card className="glass lg:col-span-2">
            <CardHeader><CardTitle>Common Queries</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {(summary.queries || []).map((q: any, i: number) => (
                  <li key={i}>{q.label} — {q.count}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Analytics;


