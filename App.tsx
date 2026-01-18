
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppView, Photo, User, EventSession } from './types';
import { ICONS } from './constants';
import PhotoCard from './components/PhotoCard';
import PhotoWall from './components/PhotoWall';
import QRScanner from './components/QRScanner';
import { generateCaption } from './services/geminiService';
import { db } from './services/db';
import { P2PManualManager } from './services/p2pConnection';
import JSZip from 'jszip';
import QRCode from 'qrcode';

type HandshakeStep = 'idle' | 'showing_offer' | 'scanning_answer' | 'scanning_offer' | 'showing_answer' | 'connected';
type SignalingMethod = 'qr' | 'link' | 'manual';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<EventSession | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showWall, setShowWall] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [qrData, setQrData] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [handshakeStep, setHandshakeStep] = useState<HandshakeStep>('idle');
  const [p2pStatus, setP2PStatus] = useState<string>('idle');
  const [activeTab, setActiveTab] = useState<SignalingMethod>('qr');
  const [manualInput, setManualInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const p2p = useRef<P2PManualManager | null>(null);

  useEffect(() => {
    const init = async () => {
      await db.init();
      
      const params = new URLSearchParams(window.location.search);
      const urlOffer = params.get('offer');

      if (urlOffer) {
        setQrData(urlOffer);
        setHandshakeStep('showing_answer');
        setView('join');
        return;
      }

      const savedUser = localStorage.getItem('eventsnap_user');
      const savedSession = localStorage.getItem('eventsnap_session');
      if (savedUser && savedSession) {
        setUser(JSON.parse(savedUser));
        setSession(JSON.parse(savedSession));
        setView('gallery');
        const localPhotos = await db.getPhotos();
        setPhotos(localPhotos);
        initP2P();
      }
    };
    init();
  }, []);

  const initP2P = useCallback(() => {
    if (p2p.current) p2p.current.destroy();
    p2p.current = new P2PManualManager({
      onStatusChange: (status) => setP2PStatus(status),
      onPhotoReceived: (photo) => {
        setPhotos(prev => {
          if (prev.find(p => p.id === photo.id)) return prev;
          db.savePhoto(photo);
          return [...prev, photo];
        });
      }
    });
    return p2p.current;
  }, []);

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const uId = Math.random().toString(36).substring(2, 10);
    const sId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newUser = { id: uId, name: formData.get('userName') as string || "Host", isHost: true };
    const newSession = { id: sId, name: formData.get('eventName') as string || "Event", hostId: uId, startTime: Date.now() };
    
    setUser(newUser);
    setSession(newSession);
    localStorage.setItem('eventsnap_user', JSON.stringify(newUser));
    localStorage.setItem('eventsnap_session', JSON.stringify(newSession));
    
    const manager = initP2P();
    const compactOffer = await manager.createOffer();
    generateQR(compactOffer);
    
    setHandshakeStep('showing_offer');
    setView('gallery');
    setShowQR(true);
  };

  const handleJoinSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!qrData) {
      alert("No invitation key found. Use the invitation link or scan a QR code.");
      return;
    }
    
    setIsConnecting(true);
    const formData = new FormData(e.currentTarget);
    const uId = Math.random().toString(36).substring(2, 10);
    const userName = (formData.get('userName') as string || "Guest").trim();
    
    const newUser = { id: uId, name: userName, isHost: false };
    const newSession = { id: 'SYNCING', name: "Connecting...", hostId: 'unknown', startTime: Date.now() };
    
    setUser(newUser);
    setSession(newSession);
    localStorage.setItem('eventsnap_user', JSON.stringify(newUser));
    localStorage.setItem('eventsnap_session', JSON.stringify(newSession));

    const manager = p2p.current || initP2P();
    try {
      const compactAnswer = await manager.createAnswer(qrData);
      generateQR(compactAnswer);
      setView('gallery');
      setHandshakeStep('showing_answer');
      setShowQR(true);
    } catch (err) {
      console.error("Connection failed:", err);
      alert("Handshake error. The session may have timed out. Refresh both devices.");
      setIsConnecting(false);
    }
  };

  const generateQR = async (data: string) => {
    setQrData(data);
    try {
      const url = await QRCode.toDataURL(data, { 
        scale: 10,
        margin: 2,
        errorCorrectionLevel: 'L'
      });
      setQrDataUrl(url);
    } catch (e) {
      console.error("QR Generation failed", e);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualInput) return;
    const input = manualInput.trim().replace(/-/g, '');
    setManualInput('');
    await handleScannerOutput(input);
  };

  const handleScannerOutput = async (data: string) => {
    setShowScanner(false);
    
    if (data.startsWith('o|')) {
      setQrData(data);
      if (user) {
        const manager = p2p.current || initP2P();
        const compactAnswer = await manager.createAnswer(data);
        generateQR(compactAnswer);
        setHandshakeStep('showing_answer');
        setShowQR(true);
      } else {
        setView('join');
      }
    } else if (data.startsWith('a|')) {
      if (!p2p.current) {
        alert("Session error. Please refresh.");
        return;
      }
      try {
        await p2p.current.acceptAnswer(data);
        setHandshakeStep('connected');
        setShowQR(false);
      } catch (err) {
        alert("Failed to confirm connection. Scan the Guest's response QR.");
      }
    } else {
      alert("Unsupported code format.");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied!`);
    }).catch(err => {
      console.error("Clipboard blocked", err);
      alert("Please select and copy the text manually.");
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user) return;
    setIsUploading(true);
    const files = Array.from(e.target.files) as File[];

    for (const file of files) {
      const photo: Photo = {
        id: Math.random().toString(36).substring(2, 10),
        url: URL.createObjectURL(file),
        blob: file,
        senderId: user.id,
        senderName: user.name,
        timestamp: Date.now(),
        mimeType: file.type
      };

      setPhotos(prev => [...prev, photo]);
      await db.savePhoto(photo);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async () => {
          const b64 = (reader.result as string).split(',')[1];
          const caption = await generateCaption(b64, file.type);
          setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, caption } : p));
          db.savePhoto({ ...photo, caption });
          p2p.current?.broadcastPhoto({ ...photo, caption });
        };
        reader.readAsDataURL(file);
      } else {
        p2p.current?.broadcastPhoto(photo);
      }
    }
    setIsUploading(false);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    photos.forEach((p, i) => {
      const ext = p.mimeType.split('/')[1] || 'jpg';
      zip.file(`snap_${i}_${p.id}.${ext}`, p.blob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${session?.name || 'Event'}_Album.zip`;
    link.click();
  };

  const formattedCode = qrData.match(/.{1,4}/g)?.join('-') || qrData;
  const inviteUrl = session ? `${window.location.origin}${window.location.pathname}?offer=${encodeURIComponent(qrData)}` : '';

  if (showWall) return <PhotoWall photos={photos} onClose={() => setShowWall(false)} />;
  if (showScanner) return <QRScanner onScan={handleScannerOutput} onClose={() => setShowScanner(false)} onManual={() => { setShowScanner(false); setActiveTab('manual'); setShowQR(true); }} />;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-10 relative">
      <header className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('home')}>
          <div className="p-3 rounded-2xl bg-blue-500 shadow-xl">
            <ICONS.Camera className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">EventSnap</h1>
        </div>
        {user && (
          <div className="flex items-center gap-3">
             <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${p2pStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
               <span className="text-[10px] font-black text-white uppercase tracking-widest">{p2pStatus}</span>
             </div>
             <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-2 hover:bg-white/10 rounded-xl text-slate-500"><ICONS.X className="w-5 h-5" /></button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full relative z-10">
        {view === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-12">
            <h2 className="text-6xl md:text-8xl font-black text-white leading-tight tracking-tighter">Event Sync.<br/><span className="text-blue-500">No Servers.</span></h2>
            <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
              <form onSubmit={handleCreateEvent} className="flex-1 glass-morphism p-8 rounded-[2.5rem] space-y-4">
                <input required name="eventName" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="Event Name" />
                <input required name="userName" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="Your Name" />
                <button type="submit" className="w-full py-5 bg-blue-600 rounded-2xl font-black text-white hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 uppercase text-sm tracking-widest">Create Album</button>
              </form>
              <div className="flex-1 flex flex-col gap-4">
                 <button onClick={() => setShowScanner(true)} className="flex-1 glass-morphism rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-all group p-8">
                   <div className="p-5 bg-blue-500/10 rounded-2xl group-hover:bg-blue-500/20 transition-colors">
                    <ICONS.Share className="w-10 h-10 text-blue-500 group-hover:scale-110 transition-transform" />
                   </div>
                   <span className="font-black uppercase tracking-widest text-xs text-white/80">Join with Camera</span>
                 </button>
                 <button onClick={() => { setHandshakeStep('scanning_offer'); setShowQR(true); setActiveTab('manual'); }} className="py-4 glass-morphism rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Joining from PC?</button>
              </div>
            </div>
          </div>
        )}

        {view === 'join' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 bg-blue-500/10 rounded-[2rem] border border-blue-500/20">
              <ICONS.Users className="w-16 h-16 text-blue-500 mx-auto" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white">Join Event</h2>
              <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-widest">Invite Key Detected</p>
            </div>
            <form onSubmit={handleJoinSubmit} className="w-full max-w-md glass-morphism p-8 rounded-[2.5rem] space-y-4">
               <input required name="userName" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="Your Display Name" autoFocus />
               <button 
                 type="submit" 
                 disabled={isConnecting}
                 className={`w-full py-5 bg-blue-600 rounded-2xl font-black text-white hover:bg-blue-500 transition-all uppercase text-sm tracking-widest shadow-xl shadow-blue-500/20 ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 {isConnecting ? 'Syncing P2P...' : 'Connect Now'}
               </button>
            </form>
          </div>
        )}

        {view === 'gallery' && (
          <div className="space-y-8 pb-48">
            <div className="sticky top-6 z-40 p-4 glass-morphism rounded-3xl flex items-center justify-between border border-white/10 shadow-2xl">
               <div className="flex flex-col ml-2">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Session</span>
                 <span className="text-xl font-black text-white tracking-tight">{session?.name}</span>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setShowWall(true)} className="px-6 py-3 bg-white/5 rounded-xl text-[10px] font-black text-white hover:bg-white/10 uppercase tracking-widest">TV Wall</button>
                 <button onClick={() => { setHandshakeStep(user?.isHost ? 'showing_offer' : 'showing_answer'); setShowQR(true); }} className="px-6 py-3 bg-blue-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest">Sync Keys</button>
                 <button onClick={downloadAll} className="p-3 bg-white/10 rounded-xl text-white hover:bg-white/20" title="Download All"><ICONS.Download className="w-4 h-4" /></button>
               </div>
            </div>

            {photos.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-40 text-slate-700">
                 <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse border border-white/5">
                  <ICONS.Camera className="w-10 h-10 opacity-20" />
                 </div>
                 <p className="font-black uppercase tracking-[0.2em] text-[10px]">No photos yet</p>
                 {p2pStatus !== 'connected' && (
                   <div className="flex flex-col items-center gap-2 mt-4">
                     <p className="text-[10px] text-blue-500/30 uppercase font-black italic">Awaiting Direct Handshake</p>
                     <button onClick={() => { setHandshakeStep(user?.isHost ? 'showing_offer' : 'showing_answer'); setShowQR(true); }} className="text-[9px] font-black text-blue-500 underline underline-offset-4 uppercase tracking-widest">Open Connection Center</button>
                   </div>
                 )}
               </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {photos.sort((a,b) => b.timestamp - a.timestamp).map(p => (
                  <PhotoCard key={p.id} photo={p} />
                ))}
              </div>
            )}

            <div className="fixed bottom-10 left-0 right-0 z-50 flex justify-center">
              <label className={`cursor-pointer bg-white text-black px-16 py-8 rounded-full font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {isUploading ? 'UPLOADING...' : 'SNAP & SYNC'}
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
              </label>
            </div>
          </div>
        )}
      </main>

      {showQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl" onClick={() => setShowQR(false)}>
           <div className="bg-white p-8 md:p-10 rounded-[3rem] text-center space-y-6 w-full max-w-lg animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
             <div className="space-y-1">
               <h4 className="text-2xl font-black text-black tracking-tight uppercase">Connection Center</h4>
               <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Secure P2P Handshake</p>
             </div>

             <div className="flex bg-slate-100 p-1 rounded-2xl">
               {(['qr', 'link', 'manual'] as SignalingMethod[]).map(m => (
                 <button 
                  key={m}
                  onClick={() => setActiveTab(m)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                 >
                   {m === 'qr' ? 'Camera' : m === 'link' ? 'Invite' : 'Manual Key'}
                 </button>
               ))}
             </div>

             <div className="min-h-[300px] flex flex-col justify-center">
               {activeTab === 'qr' && (
                 <div className="space-y-4">
                    <div className="aspect-square w-full max-w-[280px] mx-auto p-4 bg-white rounded-3xl border-2 border-slate-100 flex items-center justify-center shadow-inner overflow-hidden">
                      {p2pStatus === 'gathering' ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Generating Key...</span>
                        </div>
                      ) : (
                        qrDataUrl ? <img src={qrDataUrl} className="w-full h-full object-contain image-render-pixel" alt="Handshake QR" /> : <p className="text-xs text-slate-400">Ready</p>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {handshakeStep === 'showing_offer' ? 'Friends scan this' : 'Show to the Host'}
                    </p>
                 </div>
               )}

               {activeTab === 'link' && (
                 <div className="space-y-6 py-8">
                    <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                      <ICONS.Share className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-600 leading-relaxed mb-6">Best for PC/Mobile bridge. Send this link to your phone or computer to join instantly.</p>
                      <button onClick={() => copyToClipboard(inviteUrl, 'Invite Link')} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:translate-y-px">Copy Sync Link</button>
                    </div>
                 </div>
               )}

               {activeTab === 'manual' && (
                 <div className="space-y-4">
                    <div className="text-left">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Your Device Key</label>
                      <div className="flex gap-2">
                        <input readOnly value={formattedCode} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-mono overflow-ellipsis" />
                        <button onClick={() => copyToClipboard(qrData, 'Device Key')} className="p-3 bg-slate-900 text-white rounded-xl"><ICONS.Check className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    <div className="text-left">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Paste Counterpart Key</label>
                      <textarea 
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-mono h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Paste key from other device here..."
                      />
                    </div>
                    <button onClick={handleManualSubmit} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-transform">Complete Sync</button>
                 </div>
               )}
             </div>

             <div className="space-y-3 pt-4 border-t border-slate-100">
                {handshakeStep === 'showing_offer' && (
                  <button onClick={() => { setShowScanner(true); setShowQR(false); }} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-transform">
                    Next: Scan Guest Response
                  </button>
                )}
                <button onClick={() => setShowQR(false)} className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs">Dismiss</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
