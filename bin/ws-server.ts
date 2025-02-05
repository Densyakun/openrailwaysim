import { WebSocketServer } from 'ws';
import { GameStateType, getNewSaveData } from '../lib/game.js';
import { loadSaveData, setupServer } from '../lib/server.js';
import { proxy } from 'valtio';

const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '8080');

const gameState = proxy<GameStateType>({
  data: getNewSaveData(),
});

try {
  gameState.data = loadSaveData();
} catch { }

const wss = new WebSocketServer({ port, host });

setupServer(wss, gameState.data);