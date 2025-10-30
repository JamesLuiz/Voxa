import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Ticket, 
  Calendar, 
  BarChart3, 
  Settings,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import voxaLogo from "@/assets/voxa-logo.png";
import { useState } from "react";

const menuItems = [
  { title: "Overview", icon: LayoutDashboard, path: "/dashboard" },
  { title: "Chat AI", icon: MessageSquare, path: "/dashboard/chat" },
  { title: "CRM", icon: Users, path: "/dashboard/crm" },
  { title: "Tickets", icon: Ticket, path: "/dashboard/tickets" },
  { title: "Meetings", icon: Calendar, path: "/dashboard/meetings" },
  { title: "Analytics", icon: BarChart3, path: "/dashboard/analytics" },
  { title: "Settings", icon: Settings, path: "/dashboard/settings" },
];

const DashboardSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen w-64 
          glass border-r border-border z-40
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <img src={voxaLogo} alt="Voxa" className="w-10 h-10" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Voxa
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Voxa AI Assistant v1.0
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default DashboardSidebar;
