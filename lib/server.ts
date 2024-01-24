import { subscribe } from "valtio";
import { FROM_CLIENT_DELETE_OBJECT, FROM_CLIENT_MASTER_CONTOLLER_CHANGE_STATE, FROM_CLIENT_SET_OBJECT, FROM_SERVER_STATE, FROM_SERVER_STATE_OPS, GameStateType, MessageEmitter, OnMessageInServer, fromSerializableProp, toSerializableProp, updateTime } from "./game";
import { WebSocketServer } from "ws";

export function setupServer(wss: WebSocketServer, gameState: GameStateType) {
  let messageEmitter = new MessageEmitter();

  const unsubscribe = subscribe(gameState, ops => {
    wss.clients.forEach(client => {
      const ops_: [string, string[], any?][] = []
      ops.forEach(([op_, path, value, prevValue]) => {
        const push = function () {
          ops_.push(op_ === 'delete' ? [op_, path as string[]] :
            [op_, path as string[], toSerializableProp(path as string[], value)]
          )
        }

        if (path[0] === "nowDate") {
          push()
        } else if (path[0] === "trains") {
          if (3 <= path.length) {
            if (path[2] === "speed") {
              push()
            } else if (path[2] === "bogies") {
              if (6 <= path.length) {
                if (path[4] === "axles") {
                  if (path.length === 8 && path[6] === "pointOnTrack") {
                    if (path[7] === "trackId")
                      push()
                    else if (path[7] === "length")
                      push()
                  }
                } else if (path[4] === "masterControllers") {
                  if (path.length === 7 && path[6] === "value")
                    push()
                }
              }
            } else if (path[2] === "otherBodies") {
              if (6 <= path.length) {
                if (path[4] === "masterControllers") {
                  if (path.length === 7 && path[6] === "value")
                    push()
                }
              }
            }
          } else if (path.length === 2) {
            push()
          }
        } else if (path[0] === "featureCollections") {
          if (path.length === 2) {
            push()
          }
        } else if (path[0] === "tracks") {
          if (path.length === 2) {
            push()
          }
        }/* else if (path[0] === "projectedLines") {
          if (path.length === 2) {
            push()
          }
        }*/ else if (path[0] === "switches") {
          if (path.length === 2) {
            push()
          }
        }
      })

      client.send(JSON.stringify([FROM_SERVER_STATE_OPS, ops_]))
    });
  });

  wss.on('connection', function connection(ws) {
    ws.on('error', console.error);

    ws.on('message', function message(data) {
      const [id, value] = JSON.parse(data.toString());

      messageEmitter.emit("message", id, value, ws);
    });

    const serializableGameState: any = {};
    Object.keys(gameState).forEach(key =>
      serializableGameState[key] = toSerializableProp([key], gameState[key])
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
      case FROM_CLIENT_SET_OBJECT: {
        const [objectKey, newValue, oldId] = value as [string, { id: string } & any, string];

        gameState[objectKey][newValue.id] = fromSerializableProp([objectKey, newValue.id], newValue, gameState);
        if (oldId) {
          delete gameState[objectKey][oldId];
        }

        messageEmitter.isInvalidMessage = false;
        break;
      }
      case FROM_CLIENT_DELETE_OBJECT: {
        const [objectKey, id] = value as [string, number];

        delete gameState[objectKey][id];

        messageEmitter.isInvalidMessage = false;
        break;
      }
      case FROM_CLIENT_MASTER_CONTOLLER_CHANGE_STATE: {
        const [trainId, bodyIndex, masterControllerIndex, newValue] = value;

        const train = gameState.trains[trainId];
        const carBody = bodyIndex < train.bogies.length ? train.bogies[bodyIndex] : train.otherBodies[bodyIndex - train.bogies.length];
        const masterController = carBody.masterControllers[masterControllerIndex];

        masterController.value = newValue;

        messageEmitter.isInvalidMessage = false;
        break;
      }
      default:
    }
  };

  messageEmitter.on('message', onMessage);

  wss.on('close', () => {
    clearInterval(timer);

    unsubscribe();
    messageEmitter.off('message', onMessage);
  });
}