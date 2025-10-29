import { useEffect } from 'react';

export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-dark flex items-center justify-center z-50">
      <div className="flex flex-col items-center animate-pulse">
        <img src="/logo.svg" alt="Voxa" className="w-48 h-48" />
      </div>
    </div>
  );
}
