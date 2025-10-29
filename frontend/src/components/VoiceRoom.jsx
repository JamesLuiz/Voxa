import { useState, useEffect, useCallback } from 'react';
import { LiveKitRoom, useVoiceAssistant, BarVisualizer, RoomAudioRenderer, VoiceAssistantControlBar } from '@livekit/components-react';
import '@livekit/components-styles';

function VoiceInterface() {
  const { state, audioTrack } = useVoiceAssistant();
  const [transcript, setTranscript] = useState([]);

  useEffect(() => {
    if (state === 'speaking' || state === 'listening') {
      setTranscript(prev => [...prev, {
        role: state === 'listening' ? 'user' : 'assistant',
        text: state === 'listening' ? 'Listening...' : 'Speaking...',
        timestamp: Date.now()
      }]);
    }
  }, [state]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark text-white p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="Voxa" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
            VOXA
          </h1>
          <p className="text-gray-400 mt-2">AI Voice Assistant</p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-6 h-96 overflow-y-auto">
          {transcript.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Start talking to begin conversation...
            </div>
          ) : (
            <div className="space-y-4">
              {transcript.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    item.role === 'user'
                      ? 'bg-primary/20 ml-auto max-w-[80%]'
                      : 'bg-gray-800 mr-auto max-w-[80%]'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1">
                    {item.role === 'user' ? 'You' : 'Voxa'}
                  </div>
                  <div>{item.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div className="w-64 h-24 flex items-center justify-center">
            {audioTrack && (
              <BarVisualizer
                state={state}
                barCount={5}
                trackRef={audioTrack}
                className="w-full"
              />
            )}
          </div>

          <VoiceAssistantControlBar />
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function VoiceRoom({ token, serverUrl, onDisconnect }) {
  const [connected, setConnected] = useState(false);

  const handleDisconnected = useCallback(() => {
    setConnected(false);
    onDisconnect();
  }, [onDisconnect]);

  return (
    <div className="w-full h-screen">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={true}
        video={false}
        onConnected={() => setConnected(true)}
        onDisconnected={handleDisconnected}
        className="h-full"
      >
        <VoiceInterface />
      </LiveKitRoom>
    </div>
  );
}
