
import React from 'react';
import { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-900 border border-white/5 cursor-pointer hover:scale-[1.02] transition-all duration-300"
    >
      <img 
        src={photo.url} 
        alt={photo.caption || 'Event photo'} 
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
        <p className="text-xs font-medium text-white/70 mb-1">
          Sent by {photo.sender}
        </p>
        <p className="text-sm font-semibold text-white line-clamp-2">
          {photo.caption || 'Thinking of a caption...'}
        </p>
      </div>

      {/* Source Badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 glass rounded-md text-[10px] font-bold text-white/90 uppercase tracking-tighter">
        {photo.sender.substring(0, 1)}
      </div>

      {photo.isFeatured && (
        <div className="absolute top-2 left-2 text-yellow-400 drop-shadow-md">
          ⭐
        </div>
      )}
    </div>
  );
};

export default PhotoCard;
