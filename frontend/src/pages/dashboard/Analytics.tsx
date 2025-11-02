import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSummary } from "@/lib/api.ts";

type AnalyticsSummary = {
  tickets: { open: number; progress: number; resolved: number };
  customers: { total: number };
  queries: { label: string; count: number }[];
};

const Analytics = () => {
  const { data, isLoading } = useQuery<AnalyticsSummary, Error, AnalyticsSummary>({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await getAnalyticsSummary()) as AnalyticsSummary,
  });

  const summary: AnalyticsSummary = data || { tickets: { open: 0, progress: 0, resolved: 0 }, customers: { total: 0 }, queries: [] };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-4 sm:px-0">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Customers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl sm:text-3xl font-bold">{summary.customers?.total ?? 0}</CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl sm:text-3xl font-bold">{summary.tickets?.open ?? 0}</CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">In Progress</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl sm:text-3xl font-bold">{summary.tickets?.progress ?? 0}</CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Resolved</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl sm:text-3xl font-bold">{summary.tickets?.resolved ?? 0}</CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="glass h-64" />
          <Card className="glass h-64" />
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Ticket Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Use your chart library here (donut)</div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Customer Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Use your chart library here (line)</div>
            </CardContent>
          </Card>
          <Card className="glass lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Common Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {summary.queries.map((q, i) => (
                  <li key={`${q.label}-${i}`} className="break-words">{q.label} — {q.count}</li>
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