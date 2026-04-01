import { subscribe } from "valtio";
import { MessageEmitter, OnMessageInServer, fromSerializableSaveData, toSerializableSaveData, updateTime, SyncDataType, getNewSyncData, syncDataTypeId, SerializableSaveDataType, getTypeIdByPath, Path, store } from "./game";
import { WebSocketServer } from "ws";
import { switchTrack } from "./tracks";
import { fetchHeightmap } from "./terrain";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { assignSchedulesToTrains } from "./diagram";
import { MessageCode, send } from "./ws";

export const saveFilePath = "./save.json";

function loadSavedSyncData() {
  const json = JSON.parse(readFileSync(saveFilePath, 'utf8'));

  // 開発用にセーブデータをアップデート
  if (!json.trainFormats) {
    json.trainFormats = {};
    json.trains = {};
    json.trainGroups = {};
  }

  const syncData: SyncDataType = fromSerializableSaveData(syncDataTypeId, json, getNewSyncData());

  return syncData;
}

const TIME_PERIOD_TO_SKIP_UPDATE = 0.02;

export function setupServer(wss: WebSocketServer) {
  if (existsSync(saveFilePath)) {
    try {
      store.syncData = loadSavedSyncData();
    } catch (e) {
      console.error(e);
    }
  }

  let messageEmitter = new MessageEmitter();

  const unsubscribe = subscribe(store.syncData, ops => {
    const ops_: ["set" | "delete", Path<SerializableSaveDataType>, any?][] = []
    ops.forEach(([op_, path_, value, prevValue]) => {
      // SyncDataTypeのパスのうち、Serializableなデータのみをクライアントに送信する
      // subscribeするsyncDataはSerializableでは無いため、送信するデータのパスに限り、SyncDataTypeとSerializableSaveDataTypeが一致する必要がある
      const path = path_ as Path<SerializableSaveDataType>;

      // 削除するデータに依存するデータを変更する
      if (op_ === 'delete') {
        if (path.length == 2) {
          if (path[0] === "tracks") {
            const trackId = path[1] as string;
            Object.keys(store.syncData.switches).forEach(switchId => {
              const trackSwitch = store.syncData.switches[switchId];
              const index = trackSwitch.connectedTrackIds.indexOf(trackId);
              if (index !== -1) {
                if (trackSwitch.currentConnected === index) trackSwitch.currentConnected = -1;
                trackSwitch.connectedTrackIds.splice(index, 1);
                trackSwitch.isConnectedToEnd.splice(index, 1);

                if (trackSwitch.connectedTrackIds.length === 1) {
                  // Delete switch
                  Object.values(store.syncData.tracks).forEach(track => {
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
                  delete store.syncData.switches[switchId];
                }
              }
            });
            Object.keys(store.syncData.trains).forEach(trainId => {
              const train = store.syncData.trains[trainId];
              if (train.bogies.some(bogie => bogie.axles.some(axle => axle.pointOnTrack.trackId === trackId)))
                delete store.syncData.trains[trainId];
            });
            Object.keys(store.syncData.tracks).forEach(trackId => {
              const track = store.syncData.tracks[trackId];
              if (track.connectedFromStartIsTrack && track.idOfTrackOrSwitchConnectedFromStart === trackId)
                track.idOfTrackOrSwitchConnectedFromStart = "";
              else if (track.connectedFromEndIsTrack && track.idOfTrackOrSwitchConnectedFromEnd === trackId)
                track.idOfTrackOrSwitchConnectedFromEnd = "";
            });
          } else if (path[0] === "trains") {
            const trainId = path[1] as string;
            for (const trainGroupId of Object.keys(store.syncData["trainGroups"])) {
              const index = store.syncData["trainGroups"][trainGroupId].indexOf(trainId);
              if (index !== -1)
                store.syncData["trainGroups"][trainGroupId].splice(index, 1);
            }
          } else if (path[0] === "trainGroups") {
            const trainGroupId = path[1] as string;

            for (const trainId of Object.keys(store.syncData["trains"])) {
              const trainIds = store.syncData["trainGroups"][trainGroupId];
              if (trainIds.includes(trainId))
                delete store.syncData["trains"][trainId];
            }

            for (const diagramId of Object.keys(store.syncData["diagrams"])) {
              const index = store.syncData["diagrams"][diagramId].trainGroups.indexOf(trainGroupId);
              if (index !== -1)
                store.syncData["diagrams"][diagramId].trainGroups.splice(index, 1);
            }
          } else if (path[0] === "uiOneHandleMasterControllerConfigs") {
            const uiOptionId = path[1] as string;
            for (const trainFormatId of Object.keys(store.syncData["trainFormats"])) {
              for (const cabFormat of store.syncData["trainFormats"][trainFormatId].cabFormats) {
                if (cabFormat?.oneHandleMasterControllerUIConfigId === uiOptionId)
                  cabFormat.oneHandleMasterControllerUIConfigId = "";
              }
            }
          }
        }
      }

      // 変更されたステートをクライアントに同期する
      const push = function () {
        ops_.push(op_ === 'delete' ? [op_, path] :
          [op_, path, toSerializableSaveData(getTypeIdByPath(path), value, store.syncData)]
        )
      }

      if (path[0] === "originCoordinate") {
        push()
      } else if (path[0] === "terrains") {
        push()
      } else if (path[0] === "nowDate") {
        push()
      } else if (path[0] === "trains") {
        if (3 <= path.length) {
          // TODO 同期するシリアライズでなければいけないが、シリアライズTrainにはボギーのデータがない（ボギーは保存しないのでシリアライズTrainに含まない）
          // ->
          // セーブするためのシリアル化と、同期するためのシリアル化を分ける
          // また、セーブデータではなくステート/ストアに名前変更
          /*if (path[2] === "bogies") {
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
          } else */if (path[2] === "speed") {
            push()
          } else if (path[2] === "currentDiagramId") {
            push()
          } else if (path[2] === "currentDiagramCurveIndex") {
            push()
          } else if (path[2] === "currentDiagramSectionIndex") {
            push()
          } else if (path[2] === "currentRouteIndex") {
            push()
          } else if (path[2] === "isStopping") {
            push()
          }
        } else if (path.length === 2) {
          push()
          // 追加または削除された列車にダイヤを割り当てる
          assignSchedulesToTrains(store.syncData)
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
          || path[2] === "trackModels"
          || path[2] === "beginCant"
          || path[2] === "endCant"
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
      } else if (path[0] === "diagrams") {
        push()

        // 追加または削除された列車にダイヤを割り当てる
        if (path.length === 2)
          assignSchedulesToTrains(store.syncData)
      }
    });

    wss.clients.forEach(client =>
      send(client, MessageCode.FROM_SERVER_STATE_OPS, ops_)
    );
  });

  wss.on('connection', function connection(ws) {
    ws.on('error', console.error);

    ws.on('message', function message(data) {
      const [id, value] = JSON.parse(data.toString());

      messageEmitter.emit("message", id, value, ws);
    });

    const serializableGameState: SerializableSaveDataType = toSerializableSaveData(syncDataTypeId, store.syncData, store.syncData);
    send(ws, MessageCode.FROM_SERVER_STATE, serializableGameState);
  });

  let time = new Date().getTime();

  const onUpdateTime = function () {
    const newTime = new Date().getTime();
    const delta = (newTime - time) / 1000;
    // 頻繁に更新しないようにする
    if (delta < TIME_PERIOD_TO_SKIP_UPDATE) return;

    try {
      updateTime(delta);
    } catch (e) {
      console.error(e);
    }
    time = newTime;
  };

  // 1秒毎に時間を進行する。列車の走行中は加速度が変化する。列車の位置の誤差を少なくするために必要
  const timer = setInterval(onUpdateTime, 1000);

  const onMessage: OnMessageInServer = (code, value, ws) => {
    onUpdateTime();

    try {
      switch (code) {
        case MessageCode.FROM_CLIENT_SAVE: {
          const gameState_: SyncDataType = toSerializableSaveData(syncDataTypeId, store.syncData, store.syncData);
          writeFileSync(saveFilePath, JSON.stringify(gameState_), "utf8");
          console.log("Data saved.");

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SWITCH_TRACK: {
          if (!Array.isArray(value)) break;
          const [switchId, newCurrentConnected] = value as [string, number];

          switchTrack(switchId, newCurrentConnected);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_GET_HEIGHTMAP: {
          if (!Array.isArray(value) || value.length < 2) break;
          const [tileX, tileY] = value as [number, number];

          fetchHeightmap(tileX, tileY)
            .then(heightmap =>
              (store.syncData.terrains[tileY] || (store.syncData.terrains[tileY] = {}))
              [tileX] = heightmap
            );

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SET_PROP: {
          const [propPath, newValue, oldPath] = value as [Path<SerializableSaveDataType>, any, Path<SerializableSaveDataType> | undefined];

          // 新しいキーを設定
          let object = store.syncData;
          for (let n = 0; n < propPath.length - 1; n++)
            object = (object as any)[propPath[n]];
          (object as any)[propPath[propPath.length - 1]] = fromSerializableSaveData(getTypeIdByPath(propPath), newValue, store.syncData);

          // 依存するデータの参照を新しくする
          if (oldPath) {
            if (oldPath[0] === "trains") {
              const trainId = oldPath[1] as string;
              for (const trainGroupId of Object.keys(store.syncData["trainGroups"])) {
                const index = store.syncData["trainGroups"][trainGroupId].indexOf(trainId);
                if (index !== -1)
                  store.syncData["trainGroups"][trainGroupId].splice(index, 1, propPath[1] as string);
              }
            } else if (oldPath[0] === "trainGroups") {
              const trainGroupId = oldPath[1] as string;
              for (const diagramId of Object.keys(store.syncData["diagrams"])) {
                const index = store.syncData["diagrams"][diagramId].trainGroups.indexOf(trainGroupId);
                if (index !== -1)
                  store.syncData["diagrams"][diagramId].trainGroups.splice(index, 1, propPath[1] as string);
              }
            } else if (oldPath[0] === "uiOneHandleMasterControllerConfigs") {
              const uiOptionId = oldPath[1] as string;
              for (const trainFormatId of Object.keys(store.syncData["trainFormats"])) {
                for (const cabFormat of store.syncData["trainFormats"][trainFormatId].cabFormats) {
                  if (cabFormat?.oneHandleMasterControllerUIConfigId === uiOptionId)
                    cabFormat.oneHandleMasterControllerUIConfigId = propPath[1] as string;
                }
              }
            }
          }

          // 古いキーを削除
          if (oldPath) {
            object = store.syncData;
            for (let n = 0; n < oldPath.length - 1; n++)
              object = (object as any)[oldPath[n]];
            delete (object as any)[oldPath[oldPath.length - 1]];
          }

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_DELETE_PROP: {
          const propPath = value as string[];

          let object = store.syncData;
          for (let n = 0; n < propPath.length - 1; n++)
            object = (object as any)[propPath[n]];
          delete (object as any)[propPath[propPath.length - 1]];

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_MESSAGES: {
          const messages = value as [number, any][];

          messages.forEach(([code, value_]) =>
            onMessage(code, value_, ws)
          );

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