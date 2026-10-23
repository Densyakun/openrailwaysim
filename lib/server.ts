import { subscribe } from "valtio";
import { MessageEmitter, OnMessageInServer, serialize, updateTime, orsAppDataTypeId, SerializableORSAppDataType, getTypeIdByPath, Path, store } from "./game";
import { WebSocketServer, WebSocket as WSWebSocket } from "ws";
import { switchTrack } from "./tracks";
import { fetchHeightmap } from "./terrain";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "fs";
import crypto from "crypto";
import path from "path";
import "dotenv/config";
import { assignSchedulesToTrains } from "./diagram";
import { MessageCode, send } from "./ws";
import { relocateTrainsForTimeChange } from "./diagram";
import { getSaveData, normalizeSaveData, ORSAppSaveDataType, storeSaveData } from "./save";
import { getSaveSummary, getSaveValue, removeSaveValue, setSaveValue } from "./saveAccess";
import { cleanupDependentData, deleteProp, setProp } from "./storeDependencies";

export const savesDir = "./saves";

// 前回使用したセーブデータの名前を保存するファイル（サーバー再起動時の自動読み込みに使用）
const currentSaveFileName = ".current-save";

function ensureSavesDir() {
  if (!existsSync(savesDir)) {
    mkdirSync(savesDir, { recursive: true });
  }
}

function saveFilePath(name: string): string {
  // パス・トラバーサル対策: ディレクトリ部を除去し、ファイル名に使えない文字を置換
  const basename = path.basename(name);
  const safeName = basename.replace(/[\\/:*?"<>|]/g, "_");
  return path.join(savesDir, `${safeName}.json`);
}

function listSaves(): string[] {
  ensureSavesDir();
  try {
    const files = readdirSync(savesDir);
    return files
      .filter(f => f.endsWith(".json"))
      .map(f => f.slice(0, -5));
  } catch {
    return [];
  }
}

function readCurrentSave(): string {
  try {
    const filePath = path.join(savesDir, currentSaveFileName);
    if (existsSync(filePath))
      return readFileSync(filePath, "utf8").trim();
  } catch (e) {
    console.error(e);
  }
  return "";
}

function writeCurrentSave(name: string) {
  ensureSavesDir();
  try {
    writeFileSync(path.join(savesDir, currentSaveFileName), name, "utf8");
  } catch (e) {
    console.error(e);
  }
}

function loadData(name: string): boolean {
  const filePath = saveFilePath(name);
  if (!existsSync(filePath)) return false;

  try {
    const saveData: ORSAppSaveDataType = normalizeSaveData(JSON.parse(readFileSync(filePath, 'utf8')));

    storeSaveData(saveData);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function saveData(name: string): boolean {
  ensureSavesDir();
  const filePath = saveFilePath(name);
  try {
    writeFileSync(filePath, JSON.stringify(getSaveData()), "utf8");
    console.log(`Data saved to ${filePath}`);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function deleteSave(name: string): boolean {
  const filePath = saveFilePath(name);
  if (!existsSync(filePath)) return false;
  try {
    rmSync(filePath);
    console.log(`Deleted save: ${filePath}`);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const TIME_PERIOD_TO_SKIP_UPDATE = 0.02;

export function setupServer(wss: WebSocketServer) {
  // 旧save.jsonからの移行
  const oldSavePath = "./save.json";
  if (existsSync(oldSavePath)) {
    try {
      const saves = listSaves();
      if (!saves.includes("default")) {
        const data = readFileSync(oldSavePath, 'utf8');
        const jsonData = JSON.parse(data);
        ensureSavesDir();
        writeFileSync(saveFilePath("default"), JSON.stringify(jsonData), "utf8");
        console.log("Migrated save.json to saves/default.json");
      }
    } catch (e) {
      console.error("Migration error:", e);
    }
  }

  // サーバー起動時に前回使用したセーブデータを読み込む（無ければdefault.json）
  ensureSavesDir();
  let currentSaveName = readCurrentSave();
  if (!currentSaveName || !existsSync(saveFilePath(currentSaveName)))
    currentSaveName = "default";
  if (existsSync(saveFilePath(currentSaveName))) {
    const loaded = loadData(currentSaveName);
    if (loaded) {
      writeCurrentSave(currentSaveName);
      console.log(`Loaded save data from ${saveFilePath(currentSaveName)}`);
    } else {
      console.error(`Failed to load ${saveFilePath(currentSaveName)}`);
    }
  }

  const connectionPassword = process.env.CONNECTION_PASSWORD || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const authenticatedClients = new Map<WSWebSocket, boolean>();
  const adminAuthenticatedClients = new Set<WSWebSocket>();
  const clientUsernames = new Map<WSWebSocket, string>();

  function isAdmin(ws: WSWebSocket): boolean {
    if (!authenticatedClients.get(ws)) return false;
    if (!adminPassword) return true; // 管理パスワード未設定なら認証済みで誰でも管理者
    return adminAuthenticatedClients.has(ws);
  }

  function isMcpClient(ws: WSWebSocket) {
    return (ws as unknown as { __mcp?: boolean }).__mcp === true;
  }

  function broadcastUserList() {
    const users = Array.from(wss.clients)
      .filter(ws => authenticatedClients.get(ws))
      .map(ws => ({ id: (ws as any).__id || "", username: clientUsernames.get(ws) || "Anonymous" }));
    wss.clients.forEach(client => {
      if (isMcpClient(client)) return;
      send(client, MessageCode.FROM_SERVER_USER_LIST, users);
    });
  }

  function broadcastCurrentSave() {
    wss.clients.forEach(client => {
      if (isMcpClient(client)) return;
      send(client, MessageCode.FROM_SERVER_CURRENT_SAVE, currentSaveName);
    });
  }

  function broadcastSerializableState() {
    const serializableGameState: SerializableORSAppDataType = serialize(orsAppDataTypeId, store.data);
    wss.clients.forEach(client => {
      if (isMcpClient(client)) return;
      send(client, MessageCode.FROM_SERVER_STATE, serializableGameState);
    });
  }

  let messageEmitter = new MessageEmitter();

  const unsubscribe = subscribe(store.data, ops => {
    const ops_: ["set" | "delete", Path<SerializableORSAppDataType>, any?][] = []
    ops.forEach(([op_, path_, value, prevValue]) => {
      // Serializableなデータのみをクライアントに送信する
      // subscribeするデータはSerializableでは無いため、パスと型が一致する必要がある
      const path = path_ as Path<SerializableORSAppDataType>;

      // 削除するデータに依存するデータを変更する
      if (op_ === 'delete')
        cleanupDependentData(path);

      // 変更されたステートをクライアントに同期する
      const push = function () {
        ops_.push(op_ === 'delete' ? [op_, path] :
          [op_, path, serialize(getTypeIdByPath(path), value)]
        )
      }

      const p = path_ as any[];

      if (p[0] === "originCoordinate") {
        push()
      } else if (p[0] === "terrains") {
        push()
      } else if (p[0] === "nowDate") {
        push()
      } else if (p[0] === "trainFormats") {
        push()
      } else if (p[0] === "trains") {
        if (3 <= p.length) {
          if (p[2] === "bogies") {
            if (6 <= p.length) {
              if (p[4] === "axles") {
                if (7 <= p.length) {
                  if (
                    p[6] === "pointOnTrack"
                    || p[6] === "rotationIsReversed"
                    || p[6] === "position"
                    || p[6] === "rotation"
                  ) {
                    push();
                  }
                }
              }
            } else if (5 <= p.length) {
              if (
                p[4] === "position"
                || p[4] === "rotation"
              ) {
                push();
              }
            }
          } else if (p[2] === "otherBodies") {
            if (6 <= p.length) {
              if (p[4] === "controlStand") {
                push();
              }
            } else if (5 <= p.length) {
              if (
                p[4] === "position"
                || p[4] === "rotation"
              ) {
                push();
              }
            }
          } else if (p[2] === "cabStates") {
            if (5 <= p.length) {
              if (
                p[4] === "reverser"
                || p[4] === "masterControllerValue"
              ) {
                push();
              }
            }
          } else if (p[2] === "speed") {
            push()
          } else if (p[2] === "currentDiagramId") {
            push()
          } else if (p[2] === "currentDiagramCurveIndex") {
            push()
          } else if (p[2] === "currentDiagramSectionIndex") {
            push()
          } else if (p[2] === "currentRouteIndex") {
            push()
          } else if (p[2] === "isStopping") {
            push()
          }
        } else if (p.length === 2) {
          push()
          // 追加または削除された列車にダイヤを割り当てる
          assignSchedulesToTrains(store.data)
        }
      } else if (p[0] === "trainGroups") {
        push()
      } else if (p[0] === "featureCollections") {
        if (p.length === 2) {
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
          || path[2] === "position"
        )) {
          push()
        }
      } else if (path[0] === "switches") {
        if (path.length === 2) {
          push()
        } else if (path.length === 3 && path[2] === "currentConnected") {
          push()
        }
      } else if (path[0] === "oneHandleMasterControllerUIConfigs") {
        if (path.length === 2) {
          push()
        }
      } else if (path[0] === "diagrams") {
        push()

        // 追加または削除された列車にダイヤを割り当てる
        if (path.length === 2)
          assignSchedulesToTrains(store.data)
      }
    });

    wss.clients.forEach(client => {
      if (isMcpClient(client)) return;
      send(client, MessageCode.FROM_SERVER_STATE_OPS, ops_);
    });
  });

  wss.on('connection', function connection(ws, request) {
    ws.on('error', console.error);

    (ws as any).__id = crypto.randomUUID();

    const isMcp = request.url ? new URL(request.url, 'ws://localhost').searchParams.get('mcp') === '1' : false;
    (ws as any).__mcp = isMcp;

    let authenticated = !connectionPassword;
    authenticatedClients.set(ws, authenticated);

    ws.on('message', function message(data) {
      const [id, value] = JSON.parse(data.toString());

      messageEmitter.emit("message", id, value, ws);
    });

    send(ws, MessageCode.FROM_SERVER_ADMIN_PASSWORD_REQUIRED, !!adminPassword);
    // パスワードが不要な場合のみ接続時に認証成功を通知する。
    // パスワードが必要な場合は、クライアントからの認証要求を待つ。
    if (!connectionPassword)
      send(ws, MessageCode.FROM_SERVER_AUTH_RESULT, true);

    if (!isMcp) {
      const serializableGameState: SerializableORSAppDataType = serialize(orsAppDataTypeId, store.data);
      send(ws, MessageCode.FROM_SERVER_STATE, serializableGameState);

      send(ws, MessageCode.FROM_SERVER_CURRENT_SAVE, currentSaveName);
    }

    broadcastUserList();

    ws.on('close', () => {
      authenticatedClients.delete(ws as WSWebSocket);
      clientUsernames.delete(ws as WSWebSocket);
      broadcastUserList();
    });
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

  // 一定の間隔で時間を進行する。列車の走行中は加速度が変化する。列車の位置の誤差を少なくするために必要
  const timer = setInterval(onUpdateTime, 250);

  const onMessage: OnMessageInServer = (code, value, ws) => {
    onUpdateTime();

    try {
      switch (code) {
        case MessageCode.FROM_CLIENT_AUTH: {
          const password = value as string;
          const success = password === connectionPassword;
          authenticatedClients.set(ws as WSWebSocket, success);
          send(ws, MessageCode.FROM_SERVER_AUTH_RESULT, success);
          if (success) broadcastUserList();

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SET_USERNAME: {
          if (!authenticatedClients.get(ws as WSWebSocket)) break;
          const username = (value as string).slice(0, 32);
          clientUsernames.set(ws as WSWebSocket, username);
          broadcastUserList();

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_ADMIN_AUTH: {
          if (!authenticatedClients.get(ws as WSWebSocket)) break;
          const password = value as string;
          const success = password === adminPassword;
          if (success) adminAuthenticatedClients.add(ws as WSWebSocket);
          send(ws, MessageCode.FROM_SERVER_ADMIN_AUTH_RESULT, success);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SAVE: {
          if (!isAdmin(ws as WSWebSocket)) break;
          const saveName = value as string;
          if (!saveName) break;
          if (saveData(saveName)) {
            currentSaveName = saveName;
            writeCurrentSave(currentSaveName);
            broadcastCurrentSave();
          }
          send(ws, MessageCode.FROM_SERVER_SAVE_COMPLETED);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SET_TIME: {
          if (typeof value !== 'number') break;

          const newNowDate = value as number;

          // 時刻を変更
          store.data.nowDate = newNowDate;

          // 列車を再配置
          relocateTrainsForTimeChange(store.data, newNowDate);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_LIST_SAVES: {
          const saves = listSaves();
          send(ws, MessageCode.FROM_SERVER_SAVE_LIST, saves);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_LOAD_SAVE: {
          if (!isAdmin(ws as WSWebSocket)) break;
          const loadName = value as string;
          if (!loadName) break;
          const ok = loadData(loadName);
          if (ok) {
            currentSaveName = loadName;
            writeCurrentSave(currentSaveName);
            broadcastCurrentSave();
            send(ws, MessageCode.FROM_SERVER_LOAD_COMPLETED);
            broadcastSerializableState();
          }

          messageEmitter.isInvalidMessage = false;
          break;
        }

        case MessageCode.FROM_CLIENT_DELETE_SAVE: {
          if (!isAdmin(ws as WSWebSocket)) break;
          const deleteName = value as string;
          if (!deleteName) break;
          deleteSave(deleteName);
          if (deleteName === currentSaveName) {
            currentSaveName = "";
            writeCurrentSave("");
            broadcastCurrentSave();
          }

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
              (store.data.terrains[tileY] || (store.data.terrains[tileY] = {}))
              [tileX] = heightmap
            );

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SAVE_DATA_REQUEST: {
          const [requestId, method, rawParams] = value as [number, string, unknown];

          if (typeof requestId !== 'number' || typeof method !== 'string') {
            messageEmitter.isInvalidMessage = false;
            break;
          }

          const respond = (
            response: { ok: true; result?: unknown } | { ok: false; error: string }
          ) =>
            send(ws, MessageCode.FROM_SERVER_SAVE_DATA_RESPONSE, [requestId, response]);

          try {
            if (!authenticatedClients.get(ws as WSWebSocket))
              throw new Error('not authenticated');

            const params = rawParams && typeof rawParams === 'object'
              ? rawParams as Record<string, unknown>
              : {};
            let result: unknown;

            switch (method) {
              case 'getSummary':
                result = { currentSave: currentSaveName, ...getSaveSummary() };
                break;
              case 'listSaves':
                result = { currentSave: currentSaveName, saves: listSaves() };
                break;
              case 'loadSave': {
                if (!isAdmin(ws as WSWebSocket))
                  throw new Error('admin authentication required');

                const name = typeof params.name === 'string' ? params.name : '';
                if (!name) throw new Error('name is required');
                if (!loadData(name)) throw new Error(`failed to load save: ${name}`);

                currentSaveName = name;
                writeCurrentSave(currentSaveName);
                broadcastCurrentSave();
                broadcastSerializableState();
                result = { currentSave: currentSaveName, summary: getSaveSummary() };
                break;
              }
              case 'save': {
                if (!isAdmin(ws as WSWebSocket))
                  throw new Error('admin authentication required');

                const name = typeof params.name === 'string' ? params.name : '';
                if (!name) throw new Error('name is required');
                if (!saveData(name)) throw new Error(`failed to save: ${name}`);

                currentSaveName = name;
                writeCurrentSave(currentSaveName);
                broadcastCurrentSave();
                result = { currentSave: currentSaveName };
                break;
              }
              case 'getValue': {
                const value = getSaveValue(params.path);
                result = { found: value !== undefined, value: value ?? null };
                break;
              }
              case 'setValue':
                result = setSaveValue(params.path, params.value);
                broadcastSerializableState();
                break;
              case 'deleteValue':
                result = removeSaveValue(params.path);
                broadcastSerializableState();
                break;
              default:
                throw new Error(`unknown method: ${method}`);
            }

            respond({ ok: true, result });
          } catch (e) {
            respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
          }

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SET_PROP: {
          const [propPath, newValue, oldPath] = value as [Path<SerializableORSAppDataType>, any, Path<SerializableORSAppDataType> | undefined];

          setProp(propPath, newValue, oldPath);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_DELETE_PROP: {
          const propPath = value as string[];

          deleteProp(propPath as Path<SerializableORSAppDataType>);

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

    authenticatedClients.clear();
    adminAuthenticatedClients.clear();
    clientUsernames.clear();
  });
}