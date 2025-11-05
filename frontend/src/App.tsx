import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Splash from "./pages/Splash";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Overview from "./pages/dashboard/Overview";
import ChatAI from "./pages/dashboard/ChatAI";
import VoiceCall from "./pages/dashboard/VoiceCall";
import CRM from "./pages/dashboard/CRM";
import Tickets from "./pages/dashboard/Tickets";
import Meetings from "./pages/dashboard/Meetings";
import Analytics from "./pages/dashboard/Analytics";
import CustomerChat from "./pages/CustomerChat";
import GeneralRegister from "./pages/GeneralRegister";
import GeneralLogin from "./pages/GeneralLogin";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";

// Protected route for general chat - requires authentication
const GeneralChatProtected = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('voxa_general_token') : null;
  if (!token) {
    // Redirect to general login if not authenticated
    window.location.href = '/general/login';
    return null;
  }
  return <CustomerChat role="general" />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/general/register" element={<GeneralRegister />} />
          <Route path="/general/login" element={<GeneralLogin />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<Overview />} />
            <Route path="chat" element={<ChatAI />} />
            <Route path="voice" element={<VoiceCall />} />
            <Route path="crm" element={<CRM />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/chat/:slug" element={<CustomerChat />} />
          <Route path="/general-chat" element={<GeneralChatProtected />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
