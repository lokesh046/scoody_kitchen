import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Header } from './Header';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header />
      <main className="flex-grow max-w-3xl w-full mx-auto px-4 py-24 text-center space-y-5">
        <div className="w-16 h-16 mx-auto flex items-center justify-center border border-dashed border-cardboard bg-cardboard bg-opacity-35 rounded-[16px]">
          <Compass className="w-8 h-8 text-ink opacity-50" />
        </div>
        <p className="font-mono text-xs uppercase tracking-wider text-ink opacity-50">Error 404</p>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-ink">Page Not Found</h1>
        <p className="font-body text-sm text-ink opacity-60 max-w-md mx-auto leading-relaxed">
          That page doesn't exist, or the link may be broken. Let's get you back on track.
        </p>
        <button
          onClick={() => navigate('/')}
          className="font-mono text-xs uppercase tracking-wider font-bold text-paper bg-ink px-5 py-2.5 rounded-sm hover:bg-opacity-90 transition-colors"
        >
          Return Home
        </button>
      </main>
    </div>
  );
};
