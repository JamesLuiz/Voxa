import React from 'react';
import EmailCredentialsForm from '../components/EmailCredentialsForm';

const Settings = () => {
  // Fallback: read businessId from localStorage if no auth hook is present
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('voxa_business_id') : null;
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="grid gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Email Integration</h2>
          <p className="text-muted-foreground mb-4">
            Configure your business email to allow the AI agent to send emails on your behalf.
          </p>
          {businessId ? (
            <EmailCredentialsForm businessId={businessId} />
          ) : (
            <p>Please log in to configure email settings.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;