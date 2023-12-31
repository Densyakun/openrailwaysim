import { WebSocketServer } from 'ws';
import { getNewState } from '../lib/game.js';
import { createTestScene } from '../lib/testScene.js';
import { setupServer } from '../lib/server.js';
import { readFileSync } from 'fs';

const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '8080');

const gameState = getNewState();

const wss = new WebSocketServer({ port, host });

setupServer(wss, gameState);

const featureCollection = JSON.parse(readFileSync('./data/sakurajosui.geojson', 'utf8'));
createTestScene(gameState, featureCollection);