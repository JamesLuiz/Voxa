import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VoiceRoom from '../components/VoiceRoom';

const BACKEND_URL = 'http://localhost:3000';

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export default function VoiceChat() {
  const [roomInfo, setRoomInfo] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const query = useQuery();

  useEffect(() => {
    const role = query.get('role') || 'owner';
    const businessId = localStorage.getItem('voxa_business_id') || '';
    const participantName = role === 'owner' ? (localStorage.getItem('voxa_owner_email') || 'owner') : `guest-${Date.now()}`;
    if (!businessId) {
      setError('Missing business context. Please register first.');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/rooms/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantName, businessId, role })
        });
        if (!res.ok) throw new Error('Failed to create room');
        const data = await res.json();
        setRoomInfo(data);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-4 text-red-600">{error}</div>
        <button className="px-4 py-2 border rounded" onClick={() => navigate('/register')}>Go to Register</button>
      </div>
    );
  }

  if (!roomInfo) return <div className="p-6">Connecting to voice room...</div>;

  return (
    <VoiceRoom token={roomInfo.token} serverUrl={roomInfo.url} onDisconnect={() => navigate(-1)} />
  );
}


