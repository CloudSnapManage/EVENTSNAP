
import React, { useState, useEffect } from 'react';
import { Photo } from '../types';
import { ICONS } from '../constants';

interface PhotoWallProps {
  photos: Photo[];
  onClose: () => void;
  featuredId?: string | null;
}

const PhotoWall: React.FC<PhotoWallProps> = ({ photos, onClose, featuredId }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-switch when host features something new
  useEffect(() => {
    if (featuredId) {
      const index = photos.findIndex(p => p.id === featuredId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [featuredId, photos]);

  useEffect(() => {
    if (photos.length <= 1) return;
    
    // If we're following a featured item, don't auto-rotate immediately
    // or we can allow rotation but give featured item priority at start
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950">
        <button onClick={onClose} className="absolute right-8 top-8 text-white/50 hover:text-white transition-all">
          <ICONS.X className="h-8 w-8" />
        </button>
        <div className="text-center space-y-4">
           <div className="w-16 h-16 bg-white/5 rounded-full mx-auto flex items-center justify-center border border-white/5">
             <ICONS.Camera className="w-8 h-8 text-slate-700" />
           </div>
           <p className="text-xl font-black text-slate-500 uppercase tracking-[0.2em]">Wall is empty</p>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black overflow-hidden select-none">
      <button onClick={onClose} className="absolute right-8 top-8 z-[210] p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all backdrop-blur-md active:scale-95">
        <ICONS.X className="h-6 w-6" />
      </button>
      
      {/* Background Blur */}
      <div className="absolute inset-0 opacity-40 blur-[100px] transition-all duration-1000 scale-150 pointer-events-none">
        <img src={currentPhoto.url} className="w-full h-full object-cover" alt="" />
      </div>
      
      <div className="relative flex h-full w-full items-center justify-center p-6 md:p-20">
        <div className="relative z-10 flex h-full w-full max-w-6xl flex-col items-center justify-center gap-10">
          
          <div className="relative h-full max-h-[70vh] w-full flex items-center justify-center">
            {currentPhoto.id === featuredId && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-2 bg-yellow-500 rounded-full shadow-[0_0_40px_rgba(234,179,8,0.4)] border border-yellow-400 z-50 animate-bounce">
                <ICONS.Star className="w-4 h-4 text-white fill-current" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Host Picked This</span>
              </div>
            )}

            {currentPhoto.mimeType.startsWith('video') ? (
              <video 
                key={currentPhoto.id}
                src={currentPhoto.url} 
                autoPlay 
                muted 
                className="max-h-full max-w-full rounded-[2.5rem] object-contain shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 animate-in fade-in zoom-in-95 duration-1000" 
              />
            ) : (
              <img 
                key={currentPhoto.id}
                src={currentPhoto.url} 
                alt="Live Snap" 
                className="max-h-full max-w-full rounded-[2.5rem] object-contain shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 animate-in fade-in zoom-in-95 duration-1000" 
              />
            )}
          </div>
          
          <div className="text-center space-y-4 max-w-3xl animate-in slide-in-from-bottom-8 duration-1000">
            <h2 className="text-3xl font-black text-white md:text-5xl tracking-tight leading-tight">
              {currentPhoto.caption || "Moment captured"}
            </h2>
            <div className="flex items-center justify-center gap-3">
              <span className="w-8 h-px bg-white/20"></span>
              <p className="text-lg md:text-xl font-bold text-white/50 uppercase tracking-[0.2em]">{currentPhoto.senderName}</p>
              <span className="w-8 h-px bg-white/20"></span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-12 left-0 flex w-full justify-center gap-3 px-10 no-scrollbar">
        {photos.slice(-15).map((p, idx) => (
          <div 
            key={p.id} 
            className={`h-1 rounded-full transition-all duration-700 ${p.id === currentPhoto.id ? 'w-12 bg-white' : 'w-2 bg-white/10'}`} 
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoWall;
