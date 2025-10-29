import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const steps = [1, 2, 3, 4, 5];

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [owner, setOwner] = useState({ name: '', email: '', password: '' });
  const [business, setBusiness] = useState({ name: '', industry: '', phone: '', email: '', website: '', description: '', products: [], policies: '' });
  const [productInput, setProductInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const next = () => setStep((s) => Math.min(5, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, business })
      });
      if (!res.ok) throw new Error('Registration failed');
      const data = await res.json();
      setSuccess(`Registered business. ID: ${data.businessId}`);
      // Persist auth info for subsequent calls
      localStorage.setItem('voxa_token', data.token || '');
      localStorage.setItem('voxa_business_id', data.businessId || '');
      localStorage.setItem('voxa_owner_email', owner.email);
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="logo" className="w-14 h-14 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Create your business</h1>
          <p className="text-gray-500">Tell Voxa about your business to personalize the AI</p>
        </div>

        <div className="mb-6">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${(step - 1) / 4 * 100}%` }} />
          </div>
          <div className="flex justify-between text-sm mt-2 text-gray-500">
            {steps.map((s) => <span key={s} className={s === step ? 'text-[var(--primary)] font-semibold' : ''}>Step {s}</span>)}
          </div>
        </div>

        {error && <div className="p-3 mb-4 border border-red-400 text-red-600 rounded">{error}</div>}
        {success && <div className="p-3 mb-4 border border-green-400 text-green-700 rounded">{success}</div>}

        <div className="card-glass p-5">
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <input className="md:col-span-1 px-3 py-3 border rounded" placeholder="Owner name" value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
                <input className="md:col-span-1 px-3 py-3 border rounded" placeholder="Owner email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
                <input className="md:col-span-1 px-3 py-3 border rounded" type="password" placeholder="Password" value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <input className="w-full px-3 py-3 border rounded" placeholder="Business name" value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
              <div className="grid md:grid-cols-3 gap-3">
                <input className="px-3 py-3 border rounded" placeholder="Industry" value={business.industry} onChange={(e) => setBusiness({ ...business, industry: e.target.value })} />
                <input className="px-3 py-3 border rounded" placeholder="Phone" value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
                <input className="px-3 py-3 border rounded" placeholder="Email" value={business.email} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
              </div>
              <input className="w-full px-3 py-3 border rounded" placeholder="Website (optional)" value={business.website} onChange={(e) => setBusiness({ ...business, website: e.target.value })} />
            </div>
          )}

          {step === 3 && (
            <div>
              <textarea className="w-full px-3 py-3 border rounded" rows={6} maxLength={2000} placeholder="Business description" value={business.description} onChange={(e) => setBusiness({ ...business, description: e.target.value })} />
              <div className="text-right text-sm text-gray-500 mt-1">{business.description.length}/2000</div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="flex gap-2 mb-3">
                <input className="flex-1 px-3 py-3 border rounded" placeholder="Add product/service" value={productInput} onChange={(e) => setProductInput(e.target.value)} />
                <button className="px-4 rounded text-white btn-gradient" onClick={() => { if (productInput.trim()) { setBusiness({ ...business, products: [...business.products, productInput.trim()] }); setProductInput(''); } }}>+ Add</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {business.products.map((p, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-200 rounded-full text-sm">{p}</span>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <textarea className="w-full px-3 py-3 border rounded" rows={6} placeholder="Policies / FAQs" value={business.policies} onChange={(e) => setBusiness({ ...business, policies: e.target.value })} />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button disabled={step === 1} className="px-4 py-2 border rounded" onClick={prev}>Back</button>
          {step < 5 ? (
            <button className="px-4 py-2 text-white rounded btn-gradient" onClick={next}>Next</button>
          ) : (
            <button disabled={loading} className="px-4 py-2 text-white rounded btn-gradient" onClick={submit}>{loading ? 'Submitting...' : 'Submit'}</button>
          )}
        </div>
      </div>
    </div>
  );
}


