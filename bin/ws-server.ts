import { WebSocketServer } from 'ws';
import { getNewState } from '../lib/game.js';
import { loadSave, setupServer } from '../lib/server.js';

const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '8080');

const gameState = getNewState();

loadSave(gameState);

const wss = new WebSocketServer({ port, host });

setupServer(wss, gameState);