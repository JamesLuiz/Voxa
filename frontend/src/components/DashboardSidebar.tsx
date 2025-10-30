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
      <div className="fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border z-50 lg:hidden flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </Button>
        <div className="flex items-center gap-3 ml-4">
          <img src={voxaLogo} alt="Voxa" className="w-8 h-8" />
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Voxa
          </span>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 
          glass border-r border-border z-40
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full p-4 sm:p-6">
          {/* Logo - hidden on mobile since it's in the header */}
          <div className="hidden lg:flex items-center gap-3 mb-6 sm:mb-8">
            <img src={voxaLogo} alt="Voxa" className="w-8 h-8 sm:w-10 sm:h-10" />
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Voxa
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 sm:space-y-2 mt-16 lg:mt-0">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all text-sm sm:text-base ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`
                }
              >
                <item.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="pt-4 sm:pt-6 border-t border-border">
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Voxa AI Assistant v1.0
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default DashboardSidebar;