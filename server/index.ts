import { WebSocketServer } from 'ws';
import { store } from '@/lib/game';
import { loadSavedSyncData, setupServer } from '@/lib/server';

const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '8080');

try {
  store.syncData = loadSavedSyncData();
} catch { }

const wss = new WebSocketServer({ port, host });

setupServer(wss, store.syncData);