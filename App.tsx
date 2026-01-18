
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import Gallery from './components/Gallery';
import QRScanner from './components/QRScanner';
import LiveWall from './components/LiveWall';
import { Photo, AppView, EventSession } from './types';
import { P2PManualManager } from './services/p2p';
import { initDB, savePhoto, getAllPhotos, clearAlbum } from './services/db';
import { generateCaption } from './services/gemini';
import QRCode from 'react-qr-code';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [session, setSession] = useState<EventSession | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [p2pState, setP2PState] = useState<string>('disconnected');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [activeTab, setActiveTab] = useState<'offer' | 'answer'>('offer');
  
  const [offerSDP, setOfferSDP] = useState('');
  const [answerSDP, setAnswerSDP] = useState('');
  const [manualInput, setManualInput] = useState('');

  const p2pRef = useRef<P2PManualManager | null>(null);

  // Initialize DB and Load Photos
  useEffect(() => {
    const load = async () => {
      await initDB();
      const stored = await getAllPhotos();
      setPhotos(stored);
    };
    load();
  }, []);

  const handleP2PMessage = useCallback((msg: any) => {
    if (msg.type === 'CAPTION_UPDATE') {
      setPhotos(prev => prev.map(p => p.id === msg.id ? { ...p, caption: msg.text } : p));
    }
  }, []);

  const handleFileReceived = useCallback(async (photo: Photo) => {
    setPhotos(prev => [photo, ...prev]);
    await savePhoto(photo);
  }, []);

  // Setup P2P Manager
  const initP2P = useCallback(() => {
    if (p2pRef.current) return p2pRef.current;
    
    const manager = new P2PManualManager(
      setP2PState,
      handleP2PMessage,
      handleFileReceived
    );
    p2pRef.current = manager;
    return manager;
  }, [handleP2PMessage, handleFileReceived]);

  const handleCreateEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('eventName') as string;
    const host = formData.get('hostName') as string;
    
    setSession({
      id: Math.random().toString(36).substring(2, 10),
      name,
      hostName: host,
      isHost: true
    });
    setView('gallery');
    initP2P();
  };

  const handleJoinEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const guest = formData.get('guestName') as string;
    setSession({
      id: 'JOINING',
      name: 'Event',
      hostName: guest,
      isHost: false
    });
    setView('gallery');
    setShowSyncModal(true);
    setActiveTab('offer');
    initP2P();
  };

  const handleGenerateOffer = async () => {
    const manager = initP2P();
    const sdp = await manager.createOffer();
    setOfferSDP(sdp);
  };

  const handleAcceptOffer = async (sdp: string) => {
    const manager = initP2P();
    const answer = await manager.createAnswer(sdp);
    setAnswerSDP(answer);
    setActiveTab('answer');
    setShowScanner(false);
  };

  const handleAcceptAnswer = async (sdp: string) => {
    if (p2pRef.current) {
      await p2pRef.current.acceptAnswer(sdp);
      setShowSyncModal(false);
    }
  };

  // Fixed handleUpload to correctly type 'file' as File (extends Blob)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !session) return;

    // Cast FileList to File[] to ensure TS correctly identifies 'file' as a Blob/File
    const fileList = Array.from(files) as File[];
    for (const file of fileList) {
      const id = Math.random().toString(36).substring(2, 10);
      const photo: Photo = {
        id,
        blob: file,
        url: URL.createObjectURL(file),
        sender: session.hostName,
        timestamp: Date.now()
      };

      setPhotos(prev => [photo, ...prev]);
      await savePhoto(photo);

      // Trigger AI Captioning
      generateCaption(file).then(caption => {
        setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
        // Broadcast to peers
        p2pRef.current?.broadcastCaption(id, caption);
      });

      // Send via P2P
      p2pRef.current?.sendPhoto(photo);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 selection:bg-blue-500/30">
      {view !== 'home' && (
        <Header 
          eventName={session?.name || ''} 
          status={p2pState} 
          onGoHome={() => setView('home')} 
          onOpenSync={() => setShowSyncModal(true)}
        />
      )}

      <main>
        {view === 'home' ? (
          <div className="flex flex-col items-center justify-center min-h-screen px-6 py-20">
            <div className="w-full max-w-lg">
              <div className="text-center mb-12">
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-4 text-white">
                  EVENT<span className="text-blue-500">SNAP</span>
                </h1>
                <p className="text-lg text-white/50 font-medium">
                  Direct, P2P photo sharing for events. No servers, just memories.
                </p>
              </div>

              <div className="grid gap-6">
                <div className="glass p-8 rounded-[32px] border-white/10">
                  <h2 className="text-2xl font-bold mb-6">Create an Event</h2>
                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <input 
                      name="eventName"
                      required
                      placeholder="Event Name (e.g., Sarah's Wedding)"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <input 
                      name="hostName"
                      required
                      placeholder="Your Name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/20 active:scale-95">
                      Launch Event Hub
                    </button>
                  </form>
                </div>

                <div className="glass p-8 rounded-[32px] border-white/10">
                  <h2 className="text-2xl font-bold mb-6">Join an Event</h2>
                  <form onSubmit={handleJoinEvent} className="space-y-4">
                     <input 
                      name="guestName"
                      required
                      placeholder="Your Name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button className="w-full glass border-white/20 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all">
                      Scan Code to Join
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <Gallery photos={photos} onPhotoClick={setLightboxPhoto} />
            
            {/* FAB - Upload */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
              <label className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold shadow-2xl shadow-blue-600/40 cursor-pointer active:scale-95 transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>SNAP & SYNC</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>

            {/* Sidebar Controls */}
            <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-40">
               <button 
                onClick={() => setView('wall')}
                className="w-14 h-14 glass flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                title="Live Wall"
              >
                <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Connection Center Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="glass w-full max-w-2xl rounded-[40px] border-white/10 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold">Connection Center</h2>
                <p className="text-white/40 text-sm">P2P Peer-to-Peer Handshake</p>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-white/30 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8">
              <div className="flex bg-white/5 p-1 rounded-2xl mb-8">
                <button 
                  onClick={() => setActiveTab('offer')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'offer' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
                >
                  Step 1: Offer
                </button>
                <button 
                  onClick={() => setActiveTab('answer')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'answer' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
                >
                  Step 2: Answer
                </button>
              </div>

              {activeTab === 'offer' ? (
                <div className="space-y-6 text-center">
                  {offerSDP ? (
                    <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in">
                      <div className="p-4 bg-white rounded-3xl shadow-xl">
                        <QRCode value={offerSDP} size={256} level="L" />
                      </div>
                      <p className="text-white/60 text-sm max-w-sm">
                        Host: Show this QR to the guest. Guest: Scan it to generate an answer.
                      </p>
                      <button 
                        onClick={() => setShowScanner(true)}
                        className="glass px-6 py-3 rounded-xl font-bold hover:bg-white/10"
                      >
                        Scan Guest Answer QR
                      </button>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center gap-6">
                      <div className="w-20 h-20 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold">Generate Connection Offer</h3>
                      <button 
                        onClick={handleGenerateOffer}
                        className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-600/20 active:scale-95"
                      >
                        Create Invitation Code
                      </button>
                      <button 
                        onClick={() => setShowScanner(true)}
                        className="text-white/40 font-medium underline"
                      >
                        Join instead (Scan Host's Code)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 text-center animate-in slide-in-from-right">
                  {answerSDP ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="p-4 bg-white rounded-3xl shadow-xl">
                        <QRCode value={answerSDP} size={256} level="L" />
                      </div>
                      <p className="text-white/60 text-sm max-w-sm">
                        Show this response QR back to the Host to complete the handshake.
                      </p>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center gap-6">
                      <p className="text-white/60">Waiting for you to scan a host's offer code...</p>
                      <button 
                        onClick={() => setShowScanner(true)}
                        className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-bold"
                      >
                        Scan Host Offer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scanner Overlay */}
      {showScanner && (
        <QRScanner 
          onScan={(data) => {
            if (activeTab === 'offer') {
              // Host scanning Guest's answer
              handleAcceptAnswer(data);
            } else {
              // Guest scanning Host's offer
              handleAcceptOffer(data);
            }
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-5xl w-full h-full flex flex-col justify-center gap-8" onClick={e => e.stopPropagation()}>
            <img 
              src={lightboxPhoto.url} 
              className="max-h-[70vh] w-full object-contain rounded-2xl shadow-2xl" 
              alt="fullscreen" 
            />
            <div className="glass p-8 rounded-[32px] border-white/10 max-w-2xl mx-auto w-full">
               <div className="flex items-center justify-between mb-4">
                  <p className="text-blue-400 font-bold uppercase tracking-widest text-sm">
                    {lightboxPhoto.sender} &bull; {new Date(lightboxPhoto.timestamp).toLocaleTimeString()}
                  </p>
                  <a href={lightboxPhoto.url} download={`EventSnap_${lightboxPhoto.id}.jpg`} className="text-white/60 hover:text-white">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
               </div>
               <h2 className="text-2xl font-extrabold text-white leading-tight">
                 {lightboxPhoto.caption || "Generating AI thoughts..."}
               </h2>
            </div>
            <button 
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-0 right-0 glass p-4 rounded-full text-white/50 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Live Wall Mode */}
      {view === 'wall' && (
        <LiveWall photos={photos} onClose={() => setView('gallery')} />
      )}
    </div>
  );
};

export default App;
