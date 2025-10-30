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
      {/* Background gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 animate-pulse-glow" />
      
      {/* Logo container */}
  <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-primary/30 rounded-full animate-pulse-glow" />
          <img 
            src={voxaLogo} 
            alt="Voxa Logo" 
            className="relative w-32 h-32 animate-float"
          />
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Voxa
          </h1>
          <p className="text-muted-foreground text-lg">
            Your AI-powered voice for business
          </p>
        </div>
      </div>
    </div>
  );
};

export default Splash;
