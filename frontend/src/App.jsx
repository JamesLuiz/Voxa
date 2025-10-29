import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Support from './pages/Support';
import VoiceChat from './pages/VoiceChat';
import SplashScreen from './components/SplashScreen';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="/splash" element={<SplashScreen onComplete={() => {}} />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/support" element={<Support />} />
      <Route path="/voice" element={<VoiceChat />} />
      <Route path="*" element={<div className="p-6">Not found. <Link to="/register" className="text-primary">Go home</Link></div>} />
    </Routes>
  );
}

export default App;
