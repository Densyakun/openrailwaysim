import { subscribe } from "valtio";
import { FROM_SERVER_STATE, FROM_SERVER_STATE_OPS, GameStateType, MessageEmitter, OnMessageInServer, toSerializableProp, updateTime } from "./game";
import { WebSocketServer } from "ws";

export function setupServer(wss: WebSocketServer, gameState: GameStateType) {
  let messageEmitter = new MessageEmitter();

  const unsubscribe = subscribe(gameState, ops => {
    wss.clients.forEach(client =>
      client.send(JSON.stringify([FROM_SERVER_STATE_OPS, ops.map(op =>
        op[1].length === 1 ? [op[0], op[1], toSerializableProp(op[1][0] as string, op[2]), op[3]] : op
      )]))
    );
  });

  wss.on('connection', function connection(ws) {
    ws.on('error', console.error);

    ws.on('message', function message(data) {
      const [id, value] = JSON.parse(data.toString());

      messageEmitter.emit("message", id, value, ws);
    });

    const serializableGameState: any = {};
    Object.keys(gameState).forEach(key =>
      serializableGameState[key] = toSerializableProp(key, gameState[key])
    );
    ws.send(JSON.stringify([FROM_SERVER_STATE, serializableGameState]));
  });

  let time = new Date().getTime();

  const onUpdateTime = function () {
    const newTime = new Date().getTime();
    updateTime(gameState, (newTime - time) / 1000);
    time = newTime;
  };

  // 1秒毎に時間を進行する。列車の走行中は加速度が変化する。列車の位置の誤差を少なくするために必要
  const timer = setInterval(onUpdateTime, 1000);

  const onMessage: OnMessageInServer = (id, value, ws) => {
    onUpdateTime();

    switch (id) {
      default:
        break;
    }
  };

  messageEmitter.on('message', onMessage);

  wss.on('close', () => {
    clearInterval(timer);

    unsubscribe();
    messageEmitter.off('message', onMessage);
  });
}