import DashboardSidebar from "@/components/DashboardSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("voxa_token");
    if (!token) navigate("/register", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Dashboard;
