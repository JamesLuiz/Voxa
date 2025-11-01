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
  const [apiKey, setApiKey] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: 'Missing email',
        description: 'Please enter a sender email address',
        variant: 'destructive',
      });
      return;
    }
    // Save+verify flow (server already runs verification before saving)
    setIsLoading(true);
    try {
      const payload: any = { businessId, email };
      if (apiKey && apiKey.trim()) payload.apiKey = apiKey;

      const response = await fetch(`${API_BASE}/api/email-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (response.ok && body.success) {
        toast({ title: 'Saved', description: 'Email credentials saved and verified' });
        setVerified(true);
  setApiKey('');
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
    if (!email) {
      toast({ title: 'Missing email', description: 'Please enter a sender email to verify against', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    setVerified(null);
    try {
      const payload: any = { businessId, email };
      if (apiKey && apiKey.trim()) payload.apiKey = apiKey;

      const response = await fetch(`${API_BASE}/api/email-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (response.ok && body.verified) {
        setVerified(true);
        toast({ title: 'Verified', description: body.message || 'SendGrid API key verified successfully' });
      } else {
        setVerified(false);
        toast({ title: 'Verification failed', description: body.message || 'Unable to verify SendGrid API key', variant: 'destructive' });
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
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Label htmlFor="apiKey">SendGrid API Key (optional)</Label>
                <button type="button" onClick={() => setShowHelpModal(true)} className="text-sm underline">How to get a key</button>
              </div>
              <Input
                id="apiKey"
                type="password"
                placeholder="Leave blank to use server default"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your SendGrid API key will be stored encrypted if you provide it. Leave blank to use the admin-configured server SEND_GRID key.
              </p>

              {showHelpModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="bg-white p-6 rounded max-w-lg">
                    <h3 className="text-lg font-bold">Create a SendGrid API Key</h3>
                    <p className="mt-2">Follow SendGrid docs to create an API key with Mail Send permissions.</p>
                    <a className="text-blue-600 underline mt-3 block" href="https://docs.sendgrid.com/ui/account-and-settings/api-keys" target="_blank" rel="noreferrer">Open SendGrid docs</a>
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => setShowHelpModal(false)} className="px-4 py-2 bg-gray-200 rounded">Close</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleVerify} disabled={isVerifying || !email}>
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
          Your SendGrid API key will be stored encrypted. Use an API key with Mail Send permissions.
        </p>
      </CardFooter>
    </Card>
  );
};

export default EmailCredentialsForm;