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
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={voxaLogo} alt="Voxa" className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-lg p-6 shadow">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            </div>
            <div className="flex justify-between items-center">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
            <div className="text-center text-sm text-muted-foreground mt-3">
              Don't have an account? <button type="button" className="underline" onClick={() => navigate('/register')}>Sign up</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;