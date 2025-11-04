import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import voxaLogo from "@/assets/voxa-logo.png";


const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
  navigate("/login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Logo container */}
      <div className="relative z-10 flex flex-col items-center gap-10 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-primary/40 rounded-full animate-pulse-glow" />
          <div className="absolute inset-0 blur-2xl bg-accent/40 rounded-full animate-pulse-glow" style={{ animationDelay: '0.5s' }} />
          <img 
            src={voxaLogo} 
            alt="Voxa Logo" 
            className="relative w-40 h-40 animate-float drop-shadow-2xl"
          />
        </div>
        
        <div className="text-center space-y-4">
          <h1 className="text-7xl font-bold gradient-text animate-glow-pulse">
            Voxa
          </h1>
          <p className="text-muted-foreground text-xl tracking-wide">
            Your AI-powered voice for business
          </p>
          <div className="flex gap-2 justify-center mt-6">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Splash;
