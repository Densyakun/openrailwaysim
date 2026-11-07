import { gunzipSync, gzipSync } from 'fflate';
import type { SerializedTerrainCsgResult } from './terrainCsg';

export type TerrainCsgCacheEntry = {
  key: string;
  /** gzip圧縮した position / uv / normal のバイナリ（base64） */
  data?: string;
  /** 旧形式の非圧縮キャッシュ */
  position?: string;
  uv?: string;
  normal?: string;
};

export type TerrainCsgCacheSaveData = {
  version: 1;
  entries: TerrainCsgCacheEntry[];
};

const cache = new Map<string, SerializedTerrainCsgResult>();
// セーブデータに含まれる圧縮済みキャッシュ。必要になった時だけ展開する。
const savedCache = new Map<string, string>();
let totalBytes = 0;

const MAX_MEMORY_BYTES = 128 * 1024 * 1024;
const MAX_EXPORT_CHARACTERS = 4 * 1024 * 1024;

function entryBytes(entry: SerializedTerrainCsgResult) {
  return entry.position.byteLength + entry.uv.byteLength + entry.normal.byteLength;
}

function encodeBytes(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeTerrainCsgResult(result: SerializedTerrainCsgResult) {
  const position = new Uint8Array(result.position.buffer, result.position.byteOffset, result.position.byteLength);
  const uv = new Uint8Array(result.uv.buffer, result.uv.byteOffset, result.uv.byteLength);
  const normal = new Uint8Array(result.normal.buffer, result.normal.byteOffset, result.normal.byteLength);

  const bytes = new Uint8Array(12 + position.byteLength + uv.byteLength + normal.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, position.byteLength, true);
  view.setUint32(4, uv.byteLength, true);
  view.setUint32(8, normal.byteLength, true);
  bytes.set(position, 12);
  bytes.set(uv, 12 + position.byteLength);
  bytes.set(normal, 12 + position.byteLength + uv.byteLength);

  return encodeBytes(gzipSync(bytes));
}

function decodeTerrainCsgResult(data: string): SerializedTerrainCsgResult {
  const bytes = gunzipSync(decodeBytes(data));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const positionBytes = view.getUint32(0, true);
  const uvBytes = view.getUint32(4, true);
  const normalBytes = view.getUint32(8, true);

  const positionOffset = 12;
  const uvOffset = positionOffset + positionBytes;
  const normalOffset = uvOffset + uvBytes;

  return {
    position: new Float32Array(bytes.buffer, bytes.byteOffset + positionOffset, positionBytes / 4),
    uv: new Float32Array(bytes.buffer, bytes.byteOffset + uvOffset, uvBytes / 4),
    normal: new Float32Array(bytes.buffer, bytes.byteOffset + normalOffset, normalBytes / 4),
  };
}

function decodeLegacyResult(entry: TerrainCsgCacheEntry) {
  if (typeof entry.position !== 'string' || typeof entry.uv !== 'string' || typeof entry.normal !== 'string')
    return undefined;

  const decode = (value: string) => {
    const bytes = decodeBytes(value);
    return new Float32Array(bytes.buffer);
  };

  return {
    position: decode(entry.position),
    uv: decode(entry.uv),
    normal: decode(entry.normal),
  };
}

function setMemoryCachedTerrainCsg(key: string, entry: SerializedTerrainCsgResult) {
  const previous = cache.get(key);
  if (previous) {
    totalBytes -= entryBytes(previous);
    cache.delete(key);
  }

  cache.set(key, entry);
  totalBytes += entryBytes(entry);

  while (totalBytes > MAX_MEMORY_BYTES) {
    const oldest = cache.entries().next().value;
    if (!oldest) break;
    cache.delete(oldest[0]);
    totalBytes -= entryBytes(oldest[1]);
  }
}

export function getCachedTerrainCsg(key: string) {
  const entry = cache.get(key);
  if (entry) {
    // LRU: 参照されたエントリを末尾へ移動する
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }

  const compressed = savedCache.get(key);
  if (!compressed) return undefined;

  try {
    const result = decodeTerrainCsgResult(compressed);
    setMemoryCachedTerrainCsg(key, result);
    return result;
  } catch {
    savedCache.delete(key);
    return undefined;
  }
}

export function setCachedTerrainCsg(key: string, entry: SerializedTerrainCsgResult) {
  savedCache.delete(key);
  setMemoryCachedTerrainCsg(key, entry);
}

export function deleteCachedTerrainCsg(key: string) {
  const entry = cache.get(key);
  if (entry) {
    cache.delete(key);
    totalBytes -= entryBytes(entry);
  }
  savedCache.delete(key);
}

export function pruneCachedTerrainCsg(predicate: (key: string) => boolean) {
  for (const [key, entry] of cache) {
    if (!predicate(key)) continue;
    cache.delete(key);
    totalBytes -= entryBytes(entry);
  }
  for (const key of savedCache.keys()) {
    if (predicate(key)) savedCache.delete(key);
  }
}

export function clearTerrainCsgCache() {
  cache.clear();
  savedCache.clear();
  totalBytes = 0;
}

function entryCharacters(entry: TerrainCsgCacheEntry) {
  return entry.key.length
    + (entry.data?.length ?? 0)
    + (entry.position?.length ?? 0)
    + (entry.uv?.length ?? 0)
    + (entry.normal?.length ?? 0);
}

export function encodeTerrainCsgCacheEntry(
  key: string,
  value: SerializedTerrainCsgResult,
): TerrainCsgCacheEntry {
  return {
    key,
    data: encodeTerrainCsgResult(value),
  };
}

export function exportTerrainCsgCache(
  maxCharacters = MAX_EXPORT_CHARACTERS,
): TerrainCsgCacheSaveData {
  const entries: TerrainCsgCacheEntry[] = [];
  const keys = new Set<string>();
  let characters = 0;

  const append = (entry: TerrainCsgCacheEntry) => {
    if (keys.has(entry.key)) return;
    const length = entryCharacters(entry);
    if (characters + length > maxCharacters) return;
    keys.add(entry.key);
    entries.push(entry);
    characters += length;
  };

  // 最近使ったものから保存し、上限を超えない範囲に収める
  const ordered = Array.from(cache.entries()).reverse();
  for (const [key, value] of ordered) {
    const compressed = savedCache.get(key);
    append(compressed ? { key, data: compressed } : encodeTerrainCsgCacheEntry(key, value));
  }

  for (const [key, data] of savedCache) append({ key, data });

  return { version: 1, entries };
}

export function trimTerrainCsgCacheSaveData(
  data: TerrainCsgCacheSaveData | undefined,
  maxCharacters: number,
): TerrainCsgCacheSaveData | undefined {
  if (!data || !Array.isArray(data.entries)) return undefined;

  const entries: TerrainCsgCacheEntry[] = [];
  let characters = 0;

  for (const entry of data.entries) {
    const length = entryCharacters(entry);
    if (characters + length > maxCharacters) continue;
    entries.push(entry);
    characters += length;
  }

  return { version: 1, entries };
}

export function importTerrainCsgCache(data: TerrainCsgCacheSaveData | undefined) {
  clearTerrainCsgCache();
  if (!data || !Array.isArray(data.entries)) return;

  for (const entry of data.entries) {
    if (!entry || typeof entry.key !== 'string') continue;

    if (typeof entry.data === 'string') {
      savedCache.set(entry.key, entry.data);
      continue;
    }

    try {
      const result = decodeLegacyResult(entry);
      if (result) setCachedTerrainCsg(entry.key, result);
    } catch {
      continue;
    }
  }
}
