import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const GeneralLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiBase = (import.meta as any).env.VITE_API_URL;
      const res = await fetch(`${apiBase}/api/auth/general/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Login failed');
      const data = await res.json();
      localStorage.setItem('voxa_general_token', data.token || '');
      toast.success('Logged in');
      navigate('/');
    } catch (e) {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={handleSubmit} className="glass rounded-lg p-6 shadow w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold">Sign in (General)</h1>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Submitting…' : 'Continue'}</Button>
      </form>
    </div>
  );
};

export default GeneralLogin;


