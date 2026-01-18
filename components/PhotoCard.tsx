
import React, { useState } from 'react';
import { Photo } from '../types';
import Lightbox from './Lightbox';
import { ICONS } from '../constants';

interface PhotoCardProps {
  photo: Photo;
  isHost?: boolean;
  onFeature?: (id: string) => void;
  isFeatured?: boolean;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, isHost, onFeature, isFeatured }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div 
        className={`group relative overflow-hidden rounded-2xl bg-white/[0.03] border transition-all cursor-pointer hover:shadow-2xl hover:shadow-black/60 ${isFeatured ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-white/5'}`}
      >
        <div 
          onClick={() => setShowLightbox(true)}
          className="aspect-[3/4] sm:aspect-[4/5] w-full relative overflow-hidden bg-slate-900/40"
        >
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
            </div>
          )}
          
          {photo.mimeType.startsWith('video') ? (
            <video 
              src={photo.url} 
              className={`h-full w-full object-cover transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
              onLoadedData={() => setIsLoaded(true)}
              muted
              loop
              playsInline
              onMouseOver={e => e.currentTarget.play()}
              onMouseOut={e => e.currentTarget.pause()}
            />
          ) : (
            <img 
              src={photo.url} 
              alt={photo.caption || "Event moment"} 
              className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
              onLoad={() => setIsLoaded(true)}
              loading="lazy"
            />
          )}

          {/* Featured Badge */}
          {isFeatured && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-yellow-500/80 backdrop-blur-md rounded-lg border border-white/20 z-10">
              <ICONS.Star className="w-3 h-3 text-white fill-current" />
              <span className="text-[8px] font-black text-white uppercase tracking-tighter">Featured</span>
            </div>
          )}

          {/* Source Indicator (Normal) */}
          {!isFeatured && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-white">
                {photo.senderName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[9px] font-black text-white/80 uppercase tracking-tighter">{photo.senderName}</span>
            </div>
          )}

          {/* Media Type Badge */}
          {photo.mimeType.startsWith('video') && (
             <div className="absolute top-2 right-2 bg-blue-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">
               VIDEO
             </div>
          )}
        </div>

        {/* Host Controls Overlay */}
        {isHost && onFeature && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onFeature(photo.id);
            }}
            className={`absolute top-2 right-2 p-2 rounded-xl backdrop-blur-md border transition-all z-20 opacity-0 group-hover:opacity-100 active:scale-90 ${isFeatured ? 'bg-yellow-500 text-white border-yellow-400' : 'bg-black/60 text-white border-white/10 hover:bg-yellow-500'}`}
            title="Feature on Live Wall"
          >
            <ICONS.Star className={`w-4 h-4 ${isFeatured ? 'fill-current' : ''}`} />
          </button>
        )}

        <div 
          onClick={() => setShowLightbox(true)}
          className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/40 to-transparent p-3 opacity-0 transition-all duration-300 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
        >
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-0.5">{photo.senderName}</p>
          <p className="text-[11px] font-bold text-white line-clamp-1 leading-snug">
            {photo.caption || "View Moment"}
          </p>
        </div>
      </div>

      {showLightbox && <Lightbox photo={photo} onClose={() => setShowLightbox(false)} />}
    </>
  );
};

export default PhotoCard;
