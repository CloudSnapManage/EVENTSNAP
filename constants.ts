
export const CHUNK_SIZE = 32768; // 32KB
export const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB
export const DB_NAME = 'EventSnap_v1';
export const STORE_NAME = 'album';
export const EVENT_ID_LENGTH = 8;
export const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};
