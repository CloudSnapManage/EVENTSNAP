
import React from 'react';
import { Photo } from '../types';
import { ICONS } from '../constants';

interface LightboxProps {
  photo: Photo;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ photo, onClose }) => {
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-300">
      <div className="absolute top-6 left-0 right-0 px-6 flex items-center justify-between z-[310]">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{photo.senderName}</span>
          <span className="text-sm font-bold text-white/90">{new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md">
          <ICONS.X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center p-4">
        {photo.mimeType.startsWith('video') ? (
          <video 
            src={photo.url} 
            controls 
            autoPlay 
            className="max-h-full max-w-full rounded-2xl shadow-2xl" 
          />
        ) : (
          <img 
            src={photo.url} 
            alt={photo.caption} 
            className="max-h-full max-w-full rounded-2xl shadow-2xl object-contain" 
          />
        )}
      </div>

      {photo.caption && (
        <div className="absolute bottom-10 left-0 right-0 px-8 text-center animate-in slide-in-from-bottom-4 duration-500">
          <p className="text-xl md:text-2xl font-black text-white leading-tight max-w-2xl mx-auto italic">
            "{photo.caption}"
          </p>
        </div>
      )}
    </div>
  );
};

export default Lightbox;
