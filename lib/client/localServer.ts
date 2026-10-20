import { MessageCode, send } from "@/lib/ws";
import { Path, SerializableORSAppDataType, createAppData, orsAppDataTypeId, serialize, store } from "@/lib/game";
import { switchTrack } from "@/lib/tracks";
import { fetchHeightmap } from "@/lib/terrain";
import { relocateTrainsForTimeChange } from "@/lib/diagram";
import { ORSAppSaveDataType, getSaveData, normalizeSaveData, storeSaveData } from "@/lib/save";
import { deleteProp, setProp, subscribeStoreDependencies } from "@/lib/storeDependencies";

export type LocalServerSocket = {
  send(data: string): void;
};

export type LocalStorageLike = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const SAVE_PREFIX = "ors.local.save.";
const CURRENT_SAVE_KEY = "ors.local.currentSave";

function createMemoryStorage(): LocalStorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function getDefaultStorage(): LocalStorageLike {
  try {
    if (typeof localStorage !== "undefined")
      return localStorage;
  } catch {
    // localStorage が無効な環境ではメモリ上に保存する
  }
  return createMemoryStorage();
}

let storage = getDefaultStorage();
let initialized = false;
let unsubscribe: (() => void) | undefined;
let currentSaveName = "";
let username = "Anonymous";

const userId = "local";

function saveKey(name: string) {
  const safeName = name.replace(/[\\/:*?"<>|]/g, "_");
  return SAVE_PREFIX + encodeURIComponent(safeName);
}

function listSaves(): string[] {
  const names: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(SAVE_PREFIX)) continue;
    try {
      names.push(decodeURIComponent(key.slice(SAVE_PREFIX.length)));
    } catch {
      names.push(key.slice(SAVE_PREFIX.length));
    }
  }
  return names.sort();
}

function saveToStorage(name: string): boolean {
  try {
    storage.setItem(saveKey(name), JSON.stringify(getSaveData()));
    currentSaveName = name;
    storage.setItem(CURRENT_SAVE_KEY, name);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function loadFromStorage(name: string): boolean {
  const raw = storage.getItem(saveKey(name));
  if (raw === null) return false;

  try {
    const saveData = normalizeSaveData(JSON.parse(raw) as ORSAppSaveDataType);
    storeSaveData(saveData);
    currentSaveName = name;
    storage.setItem(CURRENT_SAVE_KEY, name);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function deleteFromStorage(name: string) {
  storage.removeItem(saveKey(name));
  if (currentSaveName === name) {
    currentSaveName = "";
    storage.removeItem(CURRENT_SAVE_KEY);
  }
}

function sendUserList(socket: LocalServerSocket) {
  send(socket, MessageCode.FROM_SERVER_USER_LIST, [{ id: userId, username }]);
}

function initialize() {
  if (initialized) return;
  initialized = true;

  unsubscribe = subscribeStoreDependencies();

  // 前回使用したセーブデータがあれば復元する
  const savedCurrentSave = storage.getItem(CURRENT_SAVE_KEY);
  if (savedCurrentSave)
    loadFromStorage(savedCurrentSave);
}

/**
 * ブラウザ内で WebSocket サーバーの代わりに接続を開始する。
 */
export function connectLocalServer(socket: LocalServerSocket) {
  initialize();

  send(socket, MessageCode.FROM_SERVER_ADMIN_PASSWORD_REQUIRED, false);
  send(socket, MessageCode.FROM_SERVER_AUTH_RESULT, true);
  send(socket, MessageCode.FROM_SERVER_STATE, serialize(orsAppDataTypeId, store.data));
  send(socket, MessageCode.FROM_SERVER_CURRENT_SAVE, currentSaveName);
  sendUserList(socket);
}

/**
 * クライアントから送信されたメッセージを、サーバーと同じ手順でストアへ反映する。
 */
export function handleLocalServerMessage(
  code: MessageCode,
  value: unknown,
  socket: LocalServerSocket
) {
  try {
    switch (code) {
      case MessageCode.FROM_CLIENT_MESSAGES: {
        if (!Array.isArray(value)) break;
        (value as [MessageCode, unknown][]).forEach(([nestedCode, nestedValue]) =>
          handleLocalServerMessage(nestedCode, nestedValue, socket)
        );
        break;
      }
      case MessageCode.FROM_CLIENT_AUTH:
        send(socket, MessageCode.FROM_SERVER_AUTH_RESULT, true);
        break;
      case MessageCode.FROM_CLIENT_SET_USERNAME:
        username = String(value ?? "Anonymous").slice(0, 32) || "Anonymous";
        sendUserList(socket);
        break;
      case MessageCode.FROM_CLIENT_ADMIN_AUTH:
        send(socket, MessageCode.FROM_SERVER_ADMIN_AUTH_RESULT, true);
        break;
      case MessageCode.FROM_CLIENT_LIST_SAVES:
        send(socket, MessageCode.FROM_SERVER_SAVE_LIST, listSaves());
        break;
      case MessageCode.FROM_CLIENT_SAVE: {
        if (typeof value !== "string" || !value) break;
        if (saveToStorage(value))
          send(socket, MessageCode.FROM_SERVER_CURRENT_SAVE, currentSaveName);
        send(socket, MessageCode.FROM_SERVER_SAVE_COMPLETED);
        break;
      }
      case MessageCode.FROM_CLIENT_LOAD_SAVE: {
        if (typeof value !== "string" || !value) break;
        if (loadFromStorage(value)) {
          send(socket, MessageCode.FROM_SERVER_LOAD_COMPLETED);
          send(socket, MessageCode.FROM_SERVER_CURRENT_SAVE, currentSaveName);
          send(socket, MessageCode.FROM_SERVER_STATE, serialize(orsAppDataTypeId, store.data));
        }
        break;
      }
      case MessageCode.FROM_CLIENT_DELETE_SAVE: {
        if (typeof value !== "string" || !value) break;
        deleteFromStorage(value);
        send(socket, MessageCode.FROM_SERVER_CURRENT_SAVE, currentSaveName);
        break;
      }
      case MessageCode.FROM_CLIENT_SWITCH_TRACK: {
        if (!Array.isArray(value)) break;
        const [switchId, newCurrentConnected] = value as [string, number];
        switchTrack(switchId, newCurrentConnected);
        break;
      }
      case MessageCode.FROM_CLIENT_GET_HEIGHTMAP: {
        if (!Array.isArray(value) || value.length < 2) break;
        const [tileX, tileY] = value as [number, number];
        fetchHeightmap(tileX, tileY)
          .then(heightmap => {
            const row = store.data.terrains[tileY] || (store.data.terrains[tileY] = {});
            row[tileX] = heightmap;
          });
        break;
      }
      case MessageCode.FROM_CLIENT_SET_TIME: {
        if (typeof value !== "number") break;
        store.data.nowDate = value;
        relocateTrainsForTimeChange(store.data, value);
        break;
      }
      case MessageCode.FROM_CLIENT_SET_PROP: {
        const [propPath, newValue, oldPath] = value as [Path<SerializableORSAppDataType>, unknown, Path<SerializableORSAppDataType>?];
        setProp(propPath, newValue, oldPath);
        break;
      }
      case MessageCode.FROM_CLIENT_DELETE_PROP:
        deleteProp(value as Path<SerializableORSAppDataType>);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error(e);
  }
}

/**
 * テスト用にローカルサーバーの状態を初期化する。
 */
export function resetLocalServer(options?: { storage?: LocalStorageLike }) {
  unsubscribe?.();
  unsubscribe = undefined;
  initialized = false;
  currentSaveName = "";
  username = "Anonymous";
  storage = options?.storage ?? getDefaultStorage();
  store.data = createAppData();
}

export { createMemoryStorage };
