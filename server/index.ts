import { WebSocketServer } from 'ws';
import { setupServer } from '@/lib/server';

const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '8080');

const wss = new WebSocketServer({ port, host });

setupServer(wss);
