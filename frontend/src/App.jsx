import { useState, useCallback } from 'react';
import SplashScreen from './components/SplashScreen';
import VoiceRoom from './components/VoiceRoom';

const BACKEND_URL = 'http://localhost:3000';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const startConversation = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantName: `user-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      setRoomInfo(data);
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Failed to connect. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const endConversation = useCallback(() => {
    setRoomInfo(null);
    setError(null);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (roomInfo) {
    return (
      <VoiceRoom
        token={roomInfo.token}
        serverUrl={roomInfo.url}
        onDisconnect={endConversation}
      />
    );
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <img src="/logo.svg" alt="Voxa" className="w-32 h-32 mx-auto mb-6" />

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          VOXA
        </h1>

        <p className="text-gray-400 mb-8 text-lg">
          Your AI Voice Assistant
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={startConversation}
          disabled={loading}
          className="px-8 py-4 bg-gradient-to-r from-primary to-blue-400 rounded-full text-white font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </span>
          ) : (
            'Start Talking'
          )}
        </button>

        <p className="text-gray-500 text-sm mt-6">
          Click the button to start your conversation with Voxa
        </p>
      </div>
    </div>
  );
}

export default App;
