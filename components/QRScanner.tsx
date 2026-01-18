
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { ICONS } from '../constants';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  onManual?: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, onManual }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err: any) {
        let msg = "Camera access required.";
        if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('denied')) {
          msg = "Permission denied by system. Please enable camera in your settings or use the Manual Key fallback below.";
        }
        setError(msg);
        console.error("Camera access failed:", err);
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code) {
              try {
                // Support both raw keys and full invitation URLs
                if (code.data.includes('offer=')) {
                  const url = new URL(code.data);
                  const offerCode = url.searchParams.get('offer');
                  if (offerCode) {
                    onScan(offerCode);
                    return;
                  }
                }
                
                if (code.data.startsWith('o|') || code.data.startsWith('a|')) {
                  onScan(code.data);
                  return;
                }
              } catch (e) {
                if (code.data.startsWith('o|') || code.data.startsWith('a|')) {
                  onScan(code.data);
                  return;
                }
              }
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="absolute top-8 left-0 right-0 px-8 flex justify-between items-center z-10">
        <h3 className="text-xl font-black text-white uppercase tracking-widest">Scanner</h3>
        <button onClick={onClose} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all backdrop-blur-md active:scale-95">
          <ICONS.X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative w-full max-w-md aspect-square rounded-[3rem] overflow-hidden border-4 border-white/10 mx-6 bg-slate-900 shadow-2xl">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900">
             <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
                <ICONS.X className="w-8 h-8 text-rose-500" />
             </div>
             <p className="text-slate-300 font-bold leading-relaxed mb-8">{error}</p>
             <div className="flex flex-col gap-3 w-full">
               {onManual && (
                 <button onClick={onManual} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-transform">Use Manual Sync Key</button>
               )}
               <button onClick={onClose} className="w-full py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest">Go Back</button>
             </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover grayscale opacity-50" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 border-[60px] border-black/40">
              <div className="w-full h-full border-2 border-blue-500 relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,1)] scan-line" />
                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-8 border-l-8 border-blue-500 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-8 border-r-8 border-blue-500 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-8 border-l-8 border-blue-500 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-8 border-r-8 border-blue-500 rounded-br-xl" />
              </div>
            </div>
          </>
        )}
      </div>
      
      {!error && (
        <div className="mt-12 text-center space-y-6 max-w-xs px-4">
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Scan the sync code on the other device</p>
          <button onClick={onManual} className="text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 px-6 py-3 rounded-full hover:bg-blue-500/10 transition-colors active:scale-95">Prefer Manual Entry?</button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
