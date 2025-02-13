import { subscribe } from "valtio";
import { FROM_CLIENT_SET_TRAIN, FROM_CLIENT_DELETE_OBJECT, FROM_CLIENT_DELETE_PROP, FROM_CLIENT_GET_HEIGHTMAP, FROM_CLIENT_SAVE, FROM_CLIENT_SET_PROP, FROM_CLIENT_SWITCH_TRACK, FROM_SERVER_STATE, FROM_SERVER_STATE_OPS, GameStateType, MessageEmitter, OnMessageInServer, fromSerializableSaveData, toSerializableSaveData, updateTime, SaveDataType, getNewSaveData, saveDataTypeId, SerializableSaveDataType, getTypeIdByPath } from "./game";
import { WebSocketServer } from "ws";
import { switchTrack } from "./tracks";
import { fetchHeightmap } from "./terrain";
import { readFileSync, writeFileSync } from "fs";

export const saveFilePath = "./save.json";

export function loadSaveData() {
  const newState = JSON.parse(readFileSync('./save.json', 'utf8'));
  return fromSerializableSaveData(saveDataTypeId, newState, getNewSaveData()) as SaveDataType;
}

export function setupServer(wss: WebSocketServer, saveData: SaveDataType) {
  let messageEmitter = new MessageEmitter();

  const unsubscribe = subscribe(saveData, ops => {
    wss.clients.forEach(client => {
      const ops_: [string, string[], any?][] = []
      ops.forEach(([op_, path, value, prevValue]) => {
        const push = function () {
          ops_.push(op_ === 'delete' ? [op_, path as string[]] :
            [op_, path as string[], toSerializableSaveData(getTypeIdByPath(path as string[]), value)]
          )
        }

        if (path[0] === "terrains") {
          push()
        } else if (path[0] === "nowDate") {
          push()
        } else if (path[0] === "trains") {
          if (3 <= path.length) {
            if (path[2] === "speed") {
              push()
            } else if (path[2] === "bogies") {
              if (6 <= path.length) {
                if (path[4] === "axles") {
                  if (7 <= path.length)
                    if (path[6] === "pointOnTrack")
                      push()
                    else if (path[6] === "rotationIsReversed")
                      push()
                }
              }
            } else if (path[2] === "otherBodies") {
              if (6 <= path.length) {
                if (path[4] === "controlStand")
                  push()
              }
            }
          } else if (path.length === 2) {
            push()
          }
        } else if (path[0] === "trainGroups") {
          push()
        } else if (path[0] === "featureCollections") {
          if (path.length === 2) {
            push()
          }
        } else if (path[0] === "tracks") {
          if (path.length === 2) {
            push()
          } else if (path.length === 3 && (
            path[2] === "idOfTrackOrSwitchConnectedFromStart"
            || path[2] === "idOfTrackOrSwitchConnectedFromEnd"
            || path[2] === "connectedFromStartIsTrack"
            || path[2] === "connectedFromEndIsTrack"
            || path[2] === "connectedFromStartIsToEnd"
            || path[2] === "connectedFromEndIsToEnd"
          )) {
            push()
          }
        } else if (path[0] === "switches") {
          if (path.length === 2) {
            push()
          } else if (path.length === 3 && path[2] === "currentConnected") {
            push()
          }
        } else if (path[0] === "uiOneHandleMasterControllerConfigs") {
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

    const serializableGameState: SerializableSaveDataType = toSerializableSaveData(saveDataTypeId, saveData);
    ws.send(JSON.stringify([FROM_SERVER_STATE, serializableGameState]));
  });

  let time = new Date().getTime();

  const onUpdateTime = function () {
    const newTime = new Date().getTime();
    updateTime(saveData, (newTime - time) / 1000);
    time = newTime;
  };

  // 1秒毎に時間を進行する。列車の走行中は加速度が変化する。列車の位置の誤差を少なくするために必要
  const timer = setInterval(onUpdateTime, 1000);

  const onMessage: OnMessageInServer = (id, value, ws) => {
    onUpdateTime();

    try {
      switch (id) {
        case FROM_CLIENT_DELETE_OBJECT: {
          const [objectKey, id] = value as [string, string];

          if (objectKey === "tracks") {
            Object.keys(saveData.switches).forEach(switchId => {
              const trackSwitch = saveData.switches[switchId];
              const index = trackSwitch.connectedTrackIds.indexOf(id);
              if (index !== -1) {
                if (trackSwitch.currentConnected === index) trackSwitch.currentConnected = -1;
                trackSwitch.connectedTrackIds.splice(index, 1);
                trackSwitch.isConnectedToEnd.splice(index, 1);

                if (trackSwitch.connectedTrackIds.length === 1) {
                  // Delete switch
                  Object.values(saveData.tracks).forEach(track => {
                    if (track.idOfTrackOrSwitchConnectedFromStart === switchId) {
                      track.idOfTrackOrSwitchConnectedFromStart = trackSwitch.connectedTrackIds[0];
                      track.connectedFromStartIsTrack = true;
                      track.connectedFromStartIsToEnd = trackSwitch.isConnectedToEnd[0];
                    } else if (track.idOfTrackOrSwitchConnectedFromEnd === switchId) {
                      track.idOfTrackOrSwitchConnectedFromEnd = trackSwitch.connectedTrackIds[0];
                      track.connectedFromEndIsTrack = true;
                      track.connectedFromEndIsToEnd = trackSwitch.isConnectedToEnd[0];
                    }
                  })
                  delete saveData.switches[switchId];
                }
              }
            });
            Object.keys(saveData.trains).forEach(trainId => {
              const train = saveData.trains[trainId];
              if (train.bogies.some(bogie => bogie.axles.some(axle => axle.pointOnTrack.trackId === id)))
                delete saveData.trains[trainId];
            });
            Object.keys(saveData.tracks).forEach(trackId => {
              const track = saveData.tracks[trackId];
              if (track.connectedFromStartIsTrack && track.idOfTrackOrSwitchConnectedFromStart === id)
                track.idOfTrackOrSwitchConnectedFromStart = "";
              else if (track.connectedFromEndIsTrack && track.idOfTrackOrSwitchConnectedFromEnd === id)
                track.idOfTrackOrSwitchConnectedFromEnd = "";
            });
          }
          delete (saveData as any)[objectKey][id];

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case FROM_CLIENT_SAVE: {
          const gameState_: SaveDataType = toSerializableSaveData(saveDataTypeId, saveData);
          writeFileSync(saveFilePath, JSON.stringify(gameState_), "utf8");
          console.log("Data saved.");

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case FROM_CLIENT_SWITCH_TRACK: {
          const [switchId, newCurrentConnected] = value;

          switchTrack(saveData, switchId, newCurrentConnected);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case FROM_CLIENT_GET_HEIGHTMAP: {
          const [tileX, tileY] = value;

          fetchHeightmap(tileX, tileY)
            .then(heightmap =>
              (saveData.terrains[tileY] || (saveData.terrains[tileY] = {}))
              [tileX] = heightmap
            );

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case FROM_CLIENT_SET_PROP: {
          const [propPath, newValue, oldPath] = value as [string[], any, string[] | undefined];

          let object = saveData;
          if (oldPath) {
            // TODO FROM_CLIENT_DELETE_OBJECTと同様に、オブジェクトの参照も変更する
            for (let n = 0; n < oldPath.length - 1; n++)
              object = (object as any)[oldPath[n]];
            delete (object as any)[oldPath[oldPath.length - 1]];

            object = saveData;
          }
          for (let n = 0; n < propPath.length - 1; n++)
            object = (object as any)[propPath[n]];
          (object as any)[propPath[propPath.length - 1]] = fromSerializableSaveData(getTypeIdByPath(propPath), newValue, saveData);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case FROM_CLIENT_DELETE_PROP: {
          const propPath = value as string[];

          // TODO FROM_CLIENT_DELETE_OBJECTと同様に、オブジェクトの参照も変更する
          if (propPath.length == 2 && propPath[0] === "trains") {
            for (const trainGroupId in Object.keys(saveData["trainGroups"])) {
              const index = saveData["trainGroups"][trainGroupId].indexOf(propPath[1]);
              if (index !== -1)
                saveData["trainGroups"][trainGroupId].splice(index, 1);
            }
            delete saveData["trains"][propPath[1]];
          } else {
            let object = saveData;
            for (let n = 0; n < propPath.length - 1; n++)
              object = (object as any)[propPath[n]];
            delete (object as any)[propPath[propPath.length - 1]];
          }

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case FROM_CLIENT_SET_TRAIN: {
          const [[trainGroupId, trainId], newValue, oldPath] = value as [string[], any, string[] | undefined];

          // TODO データの検証

          if (oldPath) {
            if (saveData["trains"][trainId]) break;

            const [oldTrainGroupId, oldTrainId] = oldPath;
            // TODO FROM_CLIENT_DELETE_OBJECTと同様に、オブジェクトの参照も変更する
            saveData["trainGroups"][oldTrainGroupId].splice(saveData["trainGroups"][oldTrainGroupId].indexOf(oldTrainId), 1);
            delete saveData["trains"][oldTrainId];
          }
          saveData["trains"][trainId] = fromSerializableSaveData(getTypeIdByPath(["trains", trainId]), newValue, saveData);
          saveData["trainGroups"][trainGroupId].push(trainId);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        default:
      }
    } catch (e) {
      console.error(e);
    }
  };

  messageEmitter.on('message', onMessage);

  wss.on('close', () => {
    clearInterval(timer);

    unsubscribe();
    messageEmitter.off('message', onMessage);
  });
}