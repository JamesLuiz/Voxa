import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Ticket, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAnalyticsSummary } from "@/lib/api.ts";

const Overview = () => {
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('voxa_business_id') || undefined : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', businessId],
    queryFn: () => getAnalyticsSummary(businessId),
    refetchInterval: 10000, // poll every 10s for near-realtime
  });

  const stats = [
    { title: 'Total Customers', value: data ? String(data.customers.total) : isLoading ? '...' : '0', icon: Users, color: 'text-primary' },
    { title: 'Conversations (24h)', value: data ? String(data.conversations ?? 0) : isLoading ? '...' : '0', icon: MessageSquare, color: 'text-accent' },
    { title: 'Open Tickets', value: data ? String(data.tickets.open ?? 0) : isLoading ? '...' : '0', icon: Ticket, color: 'text-destructive' },
    { title: 'Resolution Rate', value: data ? `${data.resolutionRate ?? 0}%` : isLoading ? '...' : '0%', icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in px-4 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Welcome back! Here's what's happening with your business.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="glass border-2 border-transparent bg-gradient-to-br from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{stat.value}</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">&nbsp;</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <Card className="glass border-2 border-transparent bg-gradient-to-br from-primary/10 to-accent/10">
        <CardHeader>
          <CardTitle className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent text-lg sm:text-xl">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {(data?.queries?.length ? data.recentActivity : []).map((activity: any, index: number) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors gap-2 sm:gap-0"
              >
                <div>
                  <p className="font-medium text-sm sm:text-base">{activity.customer}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{activity.action}</p>
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">{new Date(activity.time).toLocaleString()}</span>
              </div>
            ))}
            {!data?.recentActivity?.length && (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;