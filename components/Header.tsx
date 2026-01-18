
import React from 'react';

interface HeaderProps {
  eventName: string;
  status: string;
  onGoHome: () => void;
  onOpenSync: () => void;
}

const Header: React.FC<HeaderProps> = ({ eventName, status, onGoHome, onOpenSync }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
      case 'connecting': return 'bg-amber-500 animate-pulse';
      case 'disconnected': return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onGoHome} className="text-xl font-extrabold tracking-tighter text-white hover:opacity-80 transition-opacity">
          EVENT<span className="text-blue-500">SNAP</span>
        </button>
        {eventName && (
          <div className="hidden md:block h-6 w-px bg-white/20 mx-2" />
        )}
        <span className="text-white/60 font-medium truncate max-w-[150px] md:max-w-none">
          {eventName || 'Lobby'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenSync}
          className="flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-white/10 transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="uppercase tracking-widest">{status === 'connected' ? 'Synced' : status}</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
