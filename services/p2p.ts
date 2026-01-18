
import { STUN_SERVERS, CHUNK_SIZE, MAX_BUFFERED_AMOUNT } from '../constants';
import { Photo } from '../types';

export class P2PManualManager {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null = null;
  onStateChange: (state: string) => void;
  onMessage: (msg: any) => void;
  onFileReceived: (photo: Photo) => void;
  private incomingFiles: Map<string, {
    chunks: (Uint8Array | null)[];
    total: number;
    mime: string;
    sender: string;
  }> = new Map();

  constructor(
    onStateChange: (state: string) => void,
    onMessage: (msg: any) => void,
    onFileReceived: (photo: Photo) => void
  ) {
    this.onStateChange = onStateChange;
    this.onMessage = onMessage;
    this.onFileReceived = onFileReceived;
    this.pc = new RTCPeerConnection(STUN_SERVERS);
    this.setupListeners();
  }

  private setupListeners() {
    this.pc.oniceconnectionstatechange = () => {
      this.onStateChange(this.pc.iceConnectionState);
    };

    this.pc.ondatachannel = (e) => {
      this.setupDataChannel(e.channel);
    };
  }

  setupDataChannel(channel: RTCDataChannel) {
    this.dc = channel;
    this.dc.binaryType = 'arraybuffer';
    this.dc.onopen = () => this.onStateChange('connected');
    this.dc.onclose = () => this.onStateChange('disconnected');
    this.dc.onmessage = (e) => this.handleMessage(e.data);
  }

  async createOffer(): Promise<string> {
    this.dc = this.pc.createDataChannel('eventsnap-sync', { ordered: true });
    this.setupDataChannel(this.dc);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete for a single-step handshake
    await new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === 'complete') resolve();
      else {
        const check = () => {
          if (this.pc.iceGatheringState === 'complete') {
            this.pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        this.pc.addEventListener('icegatheringstatechange', check);
      }
    });

    return this.compactSDP(this.pc.localDescription!.sdp);
  }

  async createAnswer(compactOffer: string): Promise<string> {
    const sdp = this.decompactSDP(compactOffer);
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === 'complete') resolve();
      else {
        const check = () => {
          if (this.pc.iceGatheringState === 'complete') {
            this.pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        this.pc.addEventListener('icegatheringstatechange', check);
      }
    });

    return this.compactSDP(this.pc.localDescription!.sdp);
  }

  async acceptAnswer(compactAnswer: string) {
    const sdp = this.decompactSDP(compactAnswer);
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  private compactSDP(sdp: string): string {
    return sdp
      .split('\r\n')
      .filter(line => {
        // Strip non-essential lines to keep QR codes dense but scannable
        return !line.startsWith('a=extmap') &&
               !line.startsWith('a=rtcp-fb') &&
               !line.startsWith('a=msid') &&
               !line.startsWith('a=ssrc') &&
               !line.startsWith('a=group:BUNDLE') &&
               !line.includes('typ relay'); // No TURN
      })
      .join('\n');
  }

  private decompactSDP(compact: string): string {
    return compact.split('\n').join('\r\n');
  }

  private handleMessage(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      const msg = JSON.parse(data);
      if (msg.type === 'META') {
        this.incomingFiles.set(msg.id, {
          chunks: new Array(msg.chunks).fill(null),
          total: msg.chunks,
          mime: msg.mime,
          sender: msg.sender || 'Guest'
        });
      } else {
        this.onMessage(msg);
      }
      return;
    }

    // Binary handling: Offset 0-7: ID, 8-11: Index, 12-End: Payload
    const view = new DataView(data);
    const decoder = new TextDecoder();
    const id = decoder.decode(new Uint8Array(data, 0, 8)).trim();
    const index = view.getUint32(8, false);
    const payload = new Uint8Array(data, 12);

    const file = this.incomingFiles.get(id);
    if (file) {
      file.chunks[index] = payload;
      const received = file.chunks.filter(c => c !== null).length;
      if (received === file.total) {
        const blob = new Blob(file.chunks as Uint8Array[], { type: file.mime });
        const photo: Photo = {
          id,
          blob,
          url: URL.createObjectURL(blob),
          sender: file.sender,
          timestamp: Date.now()
        };
        this.onFileReceived(photo);
        this.incomingFiles.delete(id);
      }
    }
  }

  async sendPhoto(photo: Photo) {
    if (!this.dc || this.dc.readyState !== 'open') return;

    const buffer = await photo.blob.arrayBuffer();
    const chunksCount = Math.ceil(buffer.byteLength / CHUNK_SIZE);

    // Send META first
    this.dc.send(JSON.stringify({
      type: 'META',
      id: photo.id.padEnd(8).substring(0, 8),
      chunks: chunksCount,
      mime: photo.blob.type,
      sender: photo.sender
    }));

    for (let i = 0; i < chunksCount; i++) {
      // Respect backpressure
      while (this.dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        await new Promise(r => setTimeout(r, 50));
      }

      const chunk = buffer.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const packet = new Uint8Array(12 + chunk.byteLength);
      
      // Header: 8 bytes for ID, 4 for Index
      const encoder = new TextEncoder();
      const idBytes = encoder.encode(photo.id.padEnd(8).substring(0, 8));
      packet.set(idBytes, 0);
      
      const view = new DataView(packet.buffer);
      view.setUint32(8, i, false);
      packet.set(new Uint8Array(chunk), 12);

      this.dc.send(packet);
    }
  }

  broadcastCaption(id: string, text: string) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify({ type: 'CAPTION_UPDATE', id, text }));
    }
  }

  close() {
    this.dc?.close();
    this.pc.close();
  }
}
