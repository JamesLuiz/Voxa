import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Ticket, TrendingUp } from "lucide-react";

const statCards = [
  { title: "Total Customers", value: "2,543", change: "+12%", icon: Users, color: "text-primary" },
  { title: "Conversations", value: "1,234", change: "+8%", icon: MessageSquare, color: "text-accent" },
  { title: "Open Tickets", value: "23", change: "-5%", icon: Ticket, color: "text-destructive" },
  { title: "Resolution Rate", value: "94%", change: "+3%", icon: TrendingUp, color: "text-primary" },
];

const recentActivity = [
  { customer: "Sarah Johnson", action: "Started conversation", time: "2 min ago" },
  { customer: "Mike Chen", action: "Ticket resolved", time: "15 min ago" },
  { customer: "Emma Davis", action: "Meeting scheduled", time: "1 hour ago" },
  { customer: "Alex Thompson", action: "New customer added", time: "2 hours ago" },
];

const Overview = () => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Here's what's happening with your business.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass border-2 border-transparent bg-gradient-to-br from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{stat.value}</div>
              <p className="text-sm text-muted-foreground mt-1">
                <span className={stat.change.startsWith("+") ? "text-primary" : "text-destructive"}>
                  {stat.change}
                </span>{" "}
                from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <Card className="glass border-2 border-transparent bg-gradient-to-br from-primary/10 to-accent/10">
        <CardHeader>
          <CardTitle className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium">{activity.customer}</p>
                  <p className="text-sm text-muted-foreground">{activity.action}</p>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;
