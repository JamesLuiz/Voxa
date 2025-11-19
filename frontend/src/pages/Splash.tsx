import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import voxaLogo from "@/assets/voxa-logo.png";


const Splash = () => {
  const navigate = useNavigate();
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = useState(false);

  // Track when logo image loads
  useEffect(() => {
    const img = new Image();
    img.src = voxaLogo;
    img.onload = () => {
      setLogoLoaded(true);
    };
    img.onerror = () => {
      // Even if image fails to load, proceed after a delay
      setTimeout(() => setLogoLoaded(true), 1000);
    };
  }, []);

  // Start minimum display timer once logo is loaded
  useEffect(() => {
    if (logoLoaded) {
      const timer = setTimeout(() => {
        setMinDisplayTimeElapsed(true);
      }, 1500); // Minimum 1.5 seconds to display the logo after it loads

      return () => clearTimeout(timer);
    }
  }, [logoLoaded]);

  // Navigate once both conditions are met: logo loaded AND minimum display time elapsed
  useEffect(() => {
    if (logoLoaded && minDisplayTimeElapsed) {
    const timer = setTimeout(() => {
  navigate("/login");
      }, 300); // Small delay for smooth transition

    return () => clearTimeout(timer);
    }
  }, [logoLoaded, minDisplayTimeElapsed, navigate]);

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
            className={`relative w-40 h-40 animate-float drop-shadow-2xl transition-opacity duration-500 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLogoLoaded(true)}
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
