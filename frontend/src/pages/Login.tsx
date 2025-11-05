import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import voxaLogo from "@/assets/voxa-logo.png";
import { login } from "@/lib/api";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ email, password });
      localStorage.setItem("voxa_token", res.token || "");
      if (res.businessId) localStorage.setItem("voxa_business_id", res.businessId);
      // Store owner email if available for "My" filters
      try {
        const parsed: any = res as any;
  if (parsed?.user?.email) localStorage.setItem("voxa_owner_email", String(parsed.user.email));
  if (parsed?.user) localStorage.setItem('voxa_user', JSON.stringify(parsed.user));
      } catch (_) {}
      toast.success("Logged in");
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (() => {
        if (typeof err === "string") return err;
        if (err && typeof err === "object" && "message" in err) {
          const m = (err as { message?: unknown }).message;
          return typeof m === "string" ? m : "Login failed";
        }
        return "Login failed";
      })();
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img src={voxaLogo} alt="Voxa" className="w-16 h-16 mx-auto mb-4 animate-glow-pulse" />
          <h1 className="text-3xl font-bold gradient-text mb-2">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to access your AI dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 shadow-lg border-2 border-primary/20 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input 
                id="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="you@example.com"
                className="h-11 bg-muted/50 border-primary/20 focus:border-primary/40 transition-all" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Your password"
                className="h-11 bg-muted/50 border-primary/20 focus:border-primary/40 transition-all" 
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-12 text-base font-semibold neon-glow hover:scale-[1.02] transition-all"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="text-center text-sm text-muted-foreground pt-2">
              Don't have an account? <button type="button" className="text-primary hover:text-primary-glow underline transition-colors" onClick={() => navigate('/register')}>Sign up</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;