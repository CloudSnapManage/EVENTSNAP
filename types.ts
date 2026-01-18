
export interface Photo {
  id: string;
  url: string;
  blob: Blob;
  senderId: string;
  senderName: string;
  timestamp: number;
  caption?: string;
  mimeType: string;
}

export interface EventSession {
  id: string;
  name: string;
  hostId: string;
  startTime: number;
}

export type AppView = 'home' | 'create' | 'join' | 'gallery' | 'wall';

export interface User {
  id: string;
  name: string;
  isHost: boolean;
}
