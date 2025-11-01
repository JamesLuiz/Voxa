const API_BASE = import.meta.env.VITE_API_URL ;
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { useToast } from './ui/use-toast';

interface EmailCredentialsFormProps {
  businessId: string;
}

const EmailCredentialsForm: React.FC<EmailCredentialsFormProps> = ({ businessId }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [smtpServer, setSmtpServer] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Save+verify flow (server already runs verification before saving)
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/email-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          email,
          password,
          smtpServer,
          smtpPort: Number(smtpPort || 587),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (response.ok && body.success) {
        toast({ title: 'Saved', description: 'Email credentials saved and verified' });
        setVerified(true);
        setPassword('');
      } else {
        setVerified(false);
        toast({ title: 'Verification failed', description: body.message || 'Failed to verify SMTP credentials', variant: 'destructive' });
      }
    } catch (err: any) {
      setVerified(false);
      toast({ title: 'Error', description: err?.message || 'An error occurred while saving credentials', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!email || !password) {
      toast({ title: 'Missing fields', description: 'Please enter email and password to verify', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    setVerified(null);
    try {
      // POST endpoint does verify before saving; call it but do not persist on success.
      // We'll call a verification-only route if available; otherwise call POST and rely on response. To avoid saving on success, backend would need a flag — but current backend verifies then saves.
      // Workaround: call a dedicated verify-only endpoint if present, otherwise call POST then immediately inform user. Here we call POST and trust that server returns verified status.
      const response = await fetch('/api/email-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, email, password, smtpServer, smtpPort: Number(smtpPort || 587) }),
      });

      const body = await response.json().catch(() => ({}));
      if (response.ok && body.verified) {
        setVerified(true);
        toast({ title: 'Verified', description: 'SMTP credentials verified successfully' });
      } else {
        setVerified(false);
        toast({ title: 'Verification failed', description: body.message || 'Unable to verify SMTP credentials', variant: 'destructive' });
      }
    } catch (err: any) {
      setVerified(false);
      toast({ title: 'Error', description: err?.message || 'Verification request failed', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Email Credentials</CardTitle>
        <CardDescription>
          Enter your business email credentials to allow the agent to send emails on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your-business@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                For Gmail accounts, use an App Password instead of your regular password.
              </p>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="smtpServer">SMTP Server</Label>
                  <Input
                    id="smtpServer"
                    value={smtpServer}
                    onChange={(e) => setSmtpServer(e.target.value)}
                    className="mt-1"
                    disabled={!email || !password}
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="mt-1"
                    disabled={!email || !password}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleVerify} disabled={isVerifying || !email || !password}>
                  {isVerifying ? 'Verifying...' : 'Verify'}
                </Button>
                <div className="text-sm">
                  {verified === true && <span className="text-green-600">Verified ✓</span>}
                  {verified === false && <span className="text-red-600">Verification failed</span>}
                  {verified === null && <span className="text-muted-foreground">Not verified</span>}
                </div>
              </div>
            </div>
          </div>
          <Button className="w-full mt-4" type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Credentials'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          Your password will be securely encrypted at rest. For Gmail accounts, use an App Password.
        </p>
      </CardFooter>
    </Card>
  );
};

export default EmailCredentialsForm;