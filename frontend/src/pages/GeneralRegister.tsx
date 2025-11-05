import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const GeneralRegister = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiBase = (import.meta as any).env.VITE_API_URL;
      const res = await fetch(`${apiBase}/api/auth/general/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, location }),
      });
      if (!res.ok) throw new Error('Registration failed');
      const data = await res.json();
  localStorage.setItem('voxa_general_token', data.token || '');
  try { if (data.user) localStorage.setItem('voxa_general_user', JSON.stringify(data.user)); } catch (_) {}
      toast.success('Registered');
      navigate('/general-chat');
    } catch (e) {
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={handleSubmit} className="glass rounded-lg p-6 shadow w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold">Join Voxa (General)</h1>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
        </div>
        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Submitting…' : 'Register'}</Button>
      </form>
    </div>
  );
};

export default GeneralRegister;


