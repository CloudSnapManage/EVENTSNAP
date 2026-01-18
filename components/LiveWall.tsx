
import React, { useState, useEffect } from 'react';
import { Photo } from '../types';

interface LiveWallProps {
  photos: Photo[];
  onClose: () => void;
}

const LiveWall: React.FC<LiveWallProps> = ({ photos, onClose }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % photos.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
        <p className="text-white/40 text-2xl font-bold animate-pulse">Waiting for photos...</p>
        <button onClick={onClose} className="absolute top-8 right-8 text-white/50 hover:text-white">Close</button>
      </div>
    );
  }

  const current = photos[index];

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 transition-opacity duration-1000">
        <img 
          key={current.id}
          src={current.url} 
          className="w-full h-full object-contain animate-[fade-in_1.5s_ease-out]" 
          alt="slideshow"
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-black/90 to-transparent">
        <div className="max-w-4xl mx-auto">
          <p className="text-blue-400 text-lg font-bold mb-2 uppercase tracking-widest animate-[slide-up_0.8s_ease-out]">
            Shared by {current.sender}
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight animate-[slide-up_1s_ease-out]">
            {current.caption || "Capturing the magic..."}
          </h2>
        </div>
      </div>

      <button 
        onClick={onClose} 
        className="absolute top-8 right-8 glass p-4 rounded-full text-white/50 hover:text-white z-10"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(1.05); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default LiveWall;
