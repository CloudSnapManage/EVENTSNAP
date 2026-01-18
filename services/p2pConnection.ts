
import { Photo } from '../types';

const CHUNK_SIZE = 32 * 1024; // 32KB
const MAX_BUFFER = 1024 * 1024; // 1MB

export interface P2PCallbacks {
  onStatusChange: (status: 'idle' | 'gathering' | 'ready' | 'connected' | 'error') => void;
  onPhotoReceived: (photo: Photo) => void;
  onProgress?: (photoId: string, received: number, total: number) => void;
}

/**
 * Strips non-essential lines from SDP to keep QR codes small enough to scan
 * but keeps critical ICE information.
 */
function compactSDP(sdp: string): string {
  return sdp
    .split('\n')
    .filter(line => {
      // Remove noisy media descriptors that aren't strictly needed for a single DC
      if (line.startsWith('a=extmap:')) return false;
      if (line.startsWith('a=msid:')) return false;
      if (line.startsWith('a=rtcp-fb:')) return false;
      if (line.startsWith('a=fmtp:')) return false;
      if (line.startsWith('a=rtpmap:')) return false;
      if (line.startsWith('a=ssrc:')) return false;
      
      // Candidate filtering: Keep Host and STUN (srflx) candidates
      // Drop relay (TURN) and IPv6 to drastically reduce string length
      if (line.startsWith('a=candidate:')) {
        const isUDP = line.toLowerCase().includes('udp');
        const isEssential = line.includes('typ host') || line.includes('typ srflx');
        const isIPv6 = line.includes(':') && line.split(' ').some(part => part.includes(':'));
        return isUDP && isEssential && !isIPv6;
      }
      return true;
    })
    .join('\n')
    .replace(/\r/g, ''); // Remove CR to save a few bytes
}

export class P2PManualManager {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private callbacks: P2PCallbacks;
  
  private incomingFiles: Map<string, { 
    meta: any; 
    chunks: Uint8Array[]; 
    receivedChunks: number; 
  }> = new Map();

  constructor(callbacks: P2PCallbacks) {
    this.callbacks = callbacks;
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.pc.oniceconnectionstatechange = () => {
      console.log("[P2P] ICE State:", this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        this.callbacks.onStatusChange('connected');
      } else if (this.pc.iceConnectionState === 'failed') {
        this.callbacks.onStatusChange('error');
      }
    };

    this.pc.ondatachannel = (e) => this.setupDataChannel(e.channel);
  }

  async createOffer(): Promise<string> {
    this.callbacks.onStatusChange('gathering');
    this.dc = this.pc.createDataChannel('snap-sync', { ordered: true });
    this.setupDataChannel(this.dc);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForICE();
    
    this.callbacks.onStatusChange('ready');
    return `o|${compactSDP(this.pc.localDescription!.sdp)}`;
  }

  async createAnswer(compactData: string): Promise<string> {
    this.callbacks.onStatusChange('gathering');
    const [type, sdp] = compactData.split('|');
    if (type !== 'o') throw new Error("Expected offer (o|) format");

    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitForICE();
    
    this.callbacks.onStatusChange('ready');
    return `a|${compactSDP(this.pc.localDescription!.sdp)}`;
  }

  async acceptAnswer(compactData: string) {
    const [type, sdp] = compactData.split('|');
    if (type !== 'a') throw new Error("Expected answer (a|) format");
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  private waitForICE(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const check = () => {
          if (this.pc.iceGatheringState === 'complete') {
            this.pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        this.pc.addEventListener('icegatheringstatechange', check);
        // Quicker timeout for QR responsiveness (1.5s). Usually Host candidates arrive in ms.
        setTimeout(resolve, 1500);
      }
    });
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => {
      console.log("[P2P] DataChannel Open");
      this.callbacks.onStatusChange('connected');
    };
    dc.onmessage = (e) => this.handleMessage(e.data);
    dc.onclose = () => {
      console.log("[P2P] DataChannel Closed");
      this.callbacks.onStatusChange('idle');
    };
  }

  private async handleMessage(data: any) {
    if (typeof data === 'string') {
      const msg = JSON.parse(data);
      if (msg.type === 'META') {
        this.incomingFiles.set(msg.id, {
          meta: msg,
          chunks: new Array(Math.ceil(msg.size / CHUNK_SIZE)),
          receivedChunks: 0
        });
      }
    } else {
      const view = new Uint8Array(data);
      const photoId = new TextDecoder().decode(view.slice(0, 8)).trim();
      const chunkIndex = new DataView(view.buffer, 8, 4).getUint32(0);
      const chunkData = view.slice(12);

      const entry = this.incomingFiles.get(photoId);
      if (!entry) return;

      entry.chunks[chunkIndex] = chunkData;
      entry.receivedChunks++;

      if (this.callbacks.onProgress) {
        this.callbacks.onProgress(photoId, entry.receivedChunks * CHUNK_SIZE, entry.meta.size);
      }

      if (entry.receivedChunks === entry.chunks.length) {
        const blob = new Blob(entry.chunks, { type: entry.meta.mimeType });
        const photo: Photo = { ...entry.meta, blob, url: URL.createObjectURL(blob) };
        this.callbacks.onPhotoReceived(photo);
        this.incomingFiles.delete(photoId);
      }
    }
  }

  async broadcastPhoto(photo: Photo) {
    if (!this.dc || this.dc.readyState !== 'open') return;

    this.dc.send(JSON.stringify({
      type: 'META',
      id: photo.id,
      senderId: photo.senderId,
      senderName: photo.senderName,
      timestamp: photo.timestamp,
      caption: photo.caption,
      mimeType: photo.mimeType,
      size: photo.blob.size
    }));

    const buffer = await photo.blob.arrayBuffer();
    const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
    const idHeader = photo.id.padEnd(8).slice(0, 8);
    const idBytes = new TextEncoder().encode(idHeader);

    for (let i = 0; i < totalChunks; i++) {
      if (this.dc.bufferedAmount > MAX_BUFFER) {
        await new Promise(r => this.dc!.onbufferedamountlow = r as any);
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
      const chunk = buffer.slice(start, end);

      const packet = new Uint8Array(12 + chunk.byteLength);
      packet.set(idBytes, 0);
      new DataView(packet.buffer).setUint32(8, i);
      packet.set(new Uint8Array(chunk), 12);

      this.dc.send(packet);
    }
  }

  destroy() {
    this.pc.close();
  }
}
