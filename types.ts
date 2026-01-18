
export interface Photo {
  id: string;
  blob: Blob;
  url: string;
  caption?: string;
  sender: string;
  timestamp: number;
  isFeatured?: boolean;
}

export type AppView = 'home' | 'gallery' | 'wall' | 'join';

export interface EventSession {
  id: string;
  name: string;
  hostName: string;
  isHost: boolean;
}

export interface P2PSignal {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface P2PChunk {
  id: string;
  index: number;
  total: number;
  data: Uint8Array;
}

export interface IncomingFile {
  id: string;
  mime: string;
  chunks: (Uint8Array | null)[];
  receivedCount: number;
  totalCount: number;
  sender: string;
}
