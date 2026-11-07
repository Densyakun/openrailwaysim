import { subscribe } from "valtio";
import { MessageEmitter, OnMessageInServer, serialize, updateTime, orsAppDataTypeId, SerializableORSAppDataType, getTypeIdByPath, Path, store } from "./game";
import { WebSocketServer, WebSocket as WSWebSocket } from "ws";
import { switchTrack } from "./tracks";
import { fetchHeightmap } from "./terrain";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, promises as fsPromises } from "fs";
import crypto from "crypto";
import path from "path";
import "dotenv/config";
import { assignSchedulesToTrains } from "./diagram";
import { MessageCode, send } from "./ws";
import { relocateTrainsForTimeChange } from "./diagram";
import { getSaveData, normalizeSaveData, ORSAppSaveDataType, storeSaveData } from "./save";
import { getSaveSummary, getSaveValue, removeSaveValue, setSaveValue } from "./saveAccess";
import {
  clearSharedSaveSource, fetchSaveSourceJson, isHttpUrl, resolveSaveSource, setSharedSaveSource,
} from "./saveSource";
import { cleanupDependentData, deleteProp, setProp } from "./storeDependencies";
import {
  exportTerrainCsgCache,
  importTerrainCsgCache,
  TerrainCsgCacheSaveData,
} from "./terrainCsgCache";

export const savesDir = process.env.ORS_SAVES_DIR || "./saves";

// 蜑榊屓菴ｿ逕ｨ縺励◆繧ｻ繝ｼ繝悶ョ繝ｼ繧ｿ縺ｮ蜷榊燕繧剃ｿ晏ｭ倥☆繧九ヵ繧｡繧､繝ｫ・医し繝ｼ繝舌・蜀崎ｵｷ蜍墓凾縺ｮ閾ｪ蜍戊ｪｭ縺ｿ霎ｼ縺ｿ縺ｫ菴ｿ逕ｨ・・
const currentSaveFileName = ".current-save";

function ensureSavesDir() {
  if (!existsSync(savesDir)) {
    mkdirSync(savesDir, { recursive: true });
  }
}

function saveFilePath(name: string): string {
  // 繝代せ繝ｻ繝医Λ繝舌・繧ｵ繝ｫ蟇ｾ遲・ 蜷・そ繧ｰ繝｡繝ｳ繝医ｒ讀懆ｨｼ縺励《aves 繝・ぅ繝ｬ繧ｯ繝医Μ螟悶↓蜃ｺ縺ｪ縺・ｈ縺・↓縺吶ｋ
  const segments = name
    .replace(/\\/g, "/")
    .split("/")
    .filter(segment => segment && segment !== "." && segment !== "..");

  const safeSegments = segments
    .map(segment => segment.replace(/[\\/:*?"<>|]/g, "_"))
    .filter(segment => segment.length > 0);

  if (!safeSegments.length)
    throw new Error("save name must not be empty");

  const filePath = path.join(savesDir, ...safeSegments) + ".json";
  const resolved = path.resolve(filePath);
  const root = path.resolve(savesDir);

  if (resolved !== root && !resolved.startsWith(root + path.sep))
    throw new Error("invalid save name");

  return resolved;
}

function listSaves(directory = savesDir, prefix = ""): string[] {
  ensureSavesDir();

  try {
    const entries = readdirSync(directory, { withFileTypes: true });
    const saves: string[] = [];

    entries.forEach(entry => {
      if (entry.name.startsWith(".")) return;

      if (entry.isDirectory()) {
        saves.push(...listSaves(path.join(directory, entry.name), `${prefix}${entry.name}/`));
      } else if (entry.name.endsWith(".json")) {
        saves.push(`${prefix}${entry.name.slice(0, -5)}`);
      }
    });

    return saves.sort();
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

function resolveLocalSaveReference(reference: string, base: string) {
  if (isHttpUrl(reference) || path.isAbsolute(reference)) return reference;
  return path.resolve(path.dirname(base), reference);
}

async function loadJsonFromSource(source: string): Promise<unknown> {
  if (isHttpUrl(source)) return fetchSaveSourceJson(source);

  return JSON.parse(await fsPromises.readFile(source, "utf8"));
}

function applyResolvedSaveData(saveData: ORSAppSaveDataType, baseData: ORSAppSaveDataType, includes: string[]) {
  setSharedSaveSource(baseData, includes);
  storeSaveData(normalizeSaveData(saveData));
}

async function loadData(name: string): Promise<boolean> {
  const filePath = saveFilePath(name);
  if (!existsSync(filePath)) return false;

  try {
    const resolved = await resolveSaveSource(filePath, loadJsonFromSource, {
      resolveReference: resolveLocalSaveReference,
    });

    applyResolvedSaveData(resolved.data, resolved.baseData, resolved.includes);
    return true;
  } catch (e) {
    clearSharedSaveSource();
    console.error(e);
    return false;
  }
}

async function loadDataFromUrl(url: string): Promise<void> {
  if (!isHttpUrl(url))
    throw new Error("http:// 縺ｾ縺溘・ https:// 縺ｧ蟋九∪繧偽RL繧呈欠螳壹＠縺ｦ縺上□縺輔＞");

  try {
    const resolved = await resolveSaveSource(url, fetchSaveSourceJson);
    applyResolvedSaveData(resolved.data, resolved.baseData, resolved.includes);
  } catch (e) {
    clearSharedSaveSource();
    throw e;
  }
}

function makeIncludesRelativeToSaveFile(saveData: ORSAppSaveDataType, filePath: string) {
  if (!saveData.includes) return;

  const directory = path.dirname(filePath);
  saveData.includes = saveData.includes.map(include => {
    if (isHttpUrl(include) || !path.isAbsolute(include)) return include;

    const relative = path.relative(directory, include).split(path.sep).join("/");
    if (!relative) return include;

    return relative.startsWith(".") ? relative : `./${relative}`;
  });
}

function saveData(name: string, terrainCsgCache?: TerrainCsgCacheSaveData): boolean {
  ensureSavesDir();
  const filePath = saveFilePath(name);
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const newSaveData = getSaveData({ excludeShared: true });
    if (terrainCsgCache) {
      newSaveData.terrainCsgCache = terrainCsgCache;
      importTerrainCsgCache(terrainCsgCache);
    }
    makeIncludesRelativeToSaveFile(newSaveData, filePath);
    writeFileSync(filePath, JSON.stringify(newSaveData), "utf8");
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

export async function setupServer(wss: WebSocketServer) {
  // 譌ｧsave.json縺九ｉ縺ｮ遘ｻ陦・
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

  // 繧ｵ繝ｼ繝舌・襍ｷ蜍墓凾縺ｫ蜑榊屓菴ｿ逕ｨ縺励◆繧ｻ繝ｼ繝悶ョ繝ｼ繧ｿ繧定ｪｭ縺ｿ霎ｼ繧・育┌縺代ｌ縺ｰdefault.json・・
  ensureSavesDir();
  let currentSaveName = readCurrentSave();
  let currentSaveUrl = "";
  if (!currentSaveName || !existsSync(saveFilePath(currentSaveName)))
    currentSaveName = "default";
  if (existsSync(saveFilePath(currentSaveName))) {
    const loaded = await loadData(currentSaveName);
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
    if (!adminPassword) return true; // 邂｡逅・ヱ繧ｹ繝ｯ繝ｼ繝画悴險ｭ螳壹↑繧芽ｪ崎ｨｼ貂医∩縺ｧ隱ｰ縺ｧ繧らｮ｡逅・・
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

  function broadcastCurrentSaveUrl() {
    wss.clients.forEach(client => {
      if (isMcpClient(client)) return;
      send(client, MessageCode.FROM_SERVER_CURRENT_SAVE_URL, currentSaveUrl);
    });
  }

  function serializeStateWithCache() {
    return {
      ...serialize(orsAppDataTypeId, store.data),
      terrainCsgCache: exportTerrainCsgCache(),
    };
  }

  function broadcastSerializableState(includeTerrainCsgCache = false) {
    const serializableGameState = includeTerrainCsgCache
      ? serializeStateWithCache()
      : serialize(orsAppDataTypeId, store.data);
    wss.clients.forEach(client => {
      if (isMcpClient(client)) return;
      send(client, MessageCode.FROM_SERVER_STATE, serializableGameState);
    });
  }

  let messageEmitter = new MessageEmitter();

  const unsubscribe = subscribe(store.data, ops => {
    const ops_: ["set" | "delete", Path<SerializableORSAppDataType>, any?][] = []
    ops.forEach(([op_, path_, value, prevValue]) => {
      // Serializable縺ｪ繝・・繧ｿ縺ｮ縺ｿ繧偵け繝ｩ繧､繧｢繝ｳ繝医↓騾∽ｿ｡縺吶ｋ
      // subscribe縺吶ｋ繝・・繧ｿ縺ｯSerializable縺ｧ縺ｯ辟｡縺・◆繧√√ヱ繧ｹ縺ｨ蝙九′荳閾ｴ縺吶ｋ蠢・ｦ√′縺ゅｋ
      const path = path_ as Path<SerializableORSAppDataType>;

      // 蜑企勁縺吶ｋ繝・・繧ｿ縺ｫ萓晏ｭ倥☆繧九ョ繝ｼ繧ｿ繧貞､画峩縺吶ｋ
      if (op_ === 'delete')
        cleanupDependentData(path);

      // 螟画峩縺輔ｌ縺溘せ繝・・繝医ｒ繧ｯ繝ｩ繧､繧｢繝ｳ繝医↓蜷梧悄縺吶ｋ
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
          // 霑ｽ蜉縺ｾ縺溘・蜑企勁縺輔ｌ縺溷・霆翫↓繝繧､繝､繧貞牡繧雁ｽ薙※繧・
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

        // 霑ｽ蜉縺ｾ縺溘・蜑企勁縺輔ｌ縺溷・霆翫↓繝繧､繝､繧貞牡繧雁ｽ薙※繧・
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
    // 繝代せ繝ｯ繝ｼ繝峨′荳崎ｦ√↑蝣ｴ蜷医・縺ｿ謗･邯壽凾縺ｫ隱崎ｨｼ謌仙粥繧帝夂衍縺吶ｋ縲・
    // 繝代せ繝ｯ繝ｼ繝峨′蠢・ｦ√↑蝣ｴ蜷医・縲√け繝ｩ繧､繧｢繝ｳ繝医°繧峨・隱崎ｨｼ隕∵ｱゅｒ蠕・▽縲・
    if (!connectionPassword)
      send(ws, MessageCode.FROM_SERVER_AUTH_RESULT, true);

    if (!isMcp) {
      send(ws, MessageCode.FROM_SERVER_STATE, serializeStateWithCache());

      send(ws, MessageCode.FROM_SERVER_CURRENT_SAVE, currentSaveName);
      send(ws, MessageCode.FROM_SERVER_CURRENT_SAVE_URL, currentSaveUrl);
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
    // 鬆ｻ郢√↓譖ｴ譁ｰ縺励↑縺・ｈ縺・↓縺吶ｋ
    if (delta < TIME_PERIOD_TO_SKIP_UPDATE) return;

    try {
      updateTime(delta);
    } catch (e) {
      console.error(e);
    }
    time = newTime;
  };

  // 荳螳壹・髢馴囈縺ｧ譎る俣繧帝ｲ陦後☆繧九ょ・霆翫・襍ｰ陦御ｸｭ縺ｯ蜉騾溷ｺｦ縺悟､牙喧縺吶ｋ縲ょ・霆翫・菴咲ｽｮ縺ｮ隱､蟾ｮ繧貞ｰ代↑縺上☆繧九◆繧√↓蠢・ｦ・
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
          const saveValue = value as string | {
            name?: string;
            terrainCsgCache?: TerrainCsgCacheSaveData;
          };
          const payload = typeof saveValue === 'string'
            ? { name: saveValue, terrainCsgCache: undefined }
            : saveValue;
          const saveName = payload?.name;
          if (!saveName) break;
          if (saveData(saveName, payload.terrainCsgCache)) {
            currentSaveName = saveName;
            currentSaveUrl = "";
            writeCurrentSave(currentSaveName);
            broadcastCurrentSave();
            broadcastCurrentSaveUrl();
          }
          send(ws, MessageCode.FROM_SERVER_SAVE_COMPLETED);

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_SET_TIME: {
          if (typeof value !== 'number') break;

          const newNowDate = value as number;

          // 譎ょ綾繧貞､画峩
          store.data.nowDate = newNowDate;

          // 蛻苓ｻ翫ｒ蜀埼・鄂ｮ
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

          void loadData(loadName).then(ok => {
            if (!ok) return;

            currentSaveName = loadName;
            currentSaveUrl = "";
            writeCurrentSave(currentSaveName);
            broadcastCurrentSave();
            broadcastCurrentSaveUrl();
            send(ws, MessageCode.FROM_SERVER_LOAD_COMPLETED);
            broadcastSerializableState();
          });

          messageEmitter.isInvalidMessage = false;
          break;
        }
        case MessageCode.FROM_CLIENT_LOAD_SAVE_URL: {
          if (!isAdmin(ws as WSWebSocket)) break;
          const url = typeof value === "string" ? value.trim() : "";
          if (!url) break;

          void loadDataFromUrl(url).then(() => {
            currentSaveName = "";
            currentSaveUrl = url;
            writeCurrentSave("");
            broadcastCurrentSave();
            broadcastCurrentSaveUrl();
            send(ws, MessageCode.FROM_SERVER_LOAD_SAVE_URL_RESULT, { ok: true, url });
            broadcastSerializableState();
          }).catch(error => {
            send(ws, MessageCode.FROM_SERVER_LOAD_SAVE_URL_RESULT, {
              ok: false,
              url,
              error: error instanceof Error ? error.message : String(error),
            });
          });

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
            currentSaveUrl = "";
            writeCurrentSave("");
            broadcastCurrentSave();
            broadcastCurrentSaveUrl();
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

          void (async () => {
          try {
            if (!authenticatedClients.get(ws as WSWebSocket))
              throw new Error('not authenticated');

            const params = rawParams && typeof rawParams === 'object'
              ? rawParams as Record<string, unknown>
              : {};
            let result: unknown;

            switch (method) {
              case 'getSummary':
                result = { currentSave: currentSaveName, currentSaveUrl, ...getSaveSummary() };
                break;
              case 'listSaves':
                result = { currentSave: currentSaveName, currentSaveUrl, saves: listSaves() };
                break;
              case 'loadSave': {
                if (!isAdmin(ws as WSWebSocket))
                  throw new Error('admin authentication required');

                const name = typeof params.name === 'string' ? params.name : '';
                if (!name) throw new Error('name is required');
                if (!await loadData(name)) throw new Error(`failed to load save: ${name}`);

                currentSaveName = name;
                currentSaveUrl = "";
                writeCurrentSave(currentSaveName);
                broadcastCurrentSave();
                broadcastCurrentSaveUrl();
                broadcastSerializableState();
                result = { currentSave: currentSaveName, currentSaveUrl, summary: getSaveSummary() };
                break;
              }
              case 'loadSaveUrl': {
                if (!isAdmin(ws as WSWebSocket))
                  throw new Error('admin authentication required');

                const url = typeof params.url === 'string' ? params.url.trim() : '';
                if (!url) throw new Error('url is required');
                await loadDataFromUrl(url);

                currentSaveName = "";
                currentSaveUrl = url;
                writeCurrentSave("");
                broadcastCurrentSave();
                broadcastCurrentSaveUrl();
                broadcastSerializableState();
                result = { currentSave: currentSaveName, currentSaveUrl, url, summary: getSaveSummary() };
                break;
              }
              case 'save': {
                if (!isAdmin(ws as WSWebSocket))
                  throw new Error('admin authentication required');

                const name = typeof params.name === 'string' ? params.name : '';
                if (!name) throw new Error('name is required');
                if (!saveData(name)) throw new Error(`failed to save: ${name}`);

                currentSaveName = name;
                currentSaveUrl = "";
                writeCurrentSave(currentSaveName);
                broadcastCurrentSave();
                broadcastCurrentSaveUrl();
                result = { currentSave: currentSaveName, currentSaveUrl };
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
          })();

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