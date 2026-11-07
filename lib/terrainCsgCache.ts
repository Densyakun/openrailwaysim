import type { SerializedTerrainCsgResult } from './terrainCsg';

export type TerrainCsgCacheEntry = {
  key: string;
  position: string;
  uv: string;
  normal: string;
};

export type TerrainCsgCacheSaveData = {
  version: 1;
  entries: TerrainCsgCacheEntry[];
};

const cache = new Map<string, SerializedTerrainCsgResult>();
let totalBytes = 0;

const MAX_MEMORY_BYTES = 128 * 1024 * 1024;
const MAX_EXPORT_CHARACTERS = 4 * 1024 * 1024;

function entryBytes(entry: SerializedTerrainCsgResult) {
  return entry.position.byteLength + entry.uv.byteLength + entry.normal.byteLength;
}

function encodeFloat32(values: Float32Array) {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeFloat32(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Float32Array(bytes.buffer);
}

export function getCachedTerrainCsg(key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;

  // LRU: 参照されたエントリを末尾へ移動する
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function setCachedTerrainCsg(key: string, entry: SerializedTerrainCsgResult) {
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

export function deleteCachedTerrainCsg(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  cache.delete(key);
  totalBytes -= entryBytes(entry);
}

export function pruneCachedTerrainCsg(predicate: (key: string) => boolean) {
  for (const [key, entry] of cache) {
    if (!predicate(key)) continue;
    cache.delete(key);
    totalBytes -= entryBytes(entry);
  }
}

export function clearTerrainCsgCache() {
  cache.clear();
  totalBytes = 0;
}

export function exportTerrainCsgCache(
  maxCharacters = MAX_EXPORT_CHARACTERS,
): TerrainCsgCacheSaveData {
  const entries: TerrainCsgCacheEntry[] = [];
  let characters = 0;

  // 最近使ったものから保存し、上限を超えない範囲に収める
  const ordered = Array.from(cache.entries()).reverse();
  for (const [key, value] of ordered) {
    const entry: TerrainCsgCacheEntry = {
      key,
      position: encodeFloat32(value.position),
      uv: encodeFloat32(value.uv),
      normal: encodeFloat32(value.normal),
    };
    const entryCharacters = entry.key.length
      + entry.position.length
      + entry.uv.length
      + entry.normal.length;

    if (characters + entryCharacters > maxCharacters) continue;

    entries.push(entry);
    characters += entryCharacters;
  }

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
    const entryCharacters = entry.key.length
      + entry.position.length
      + entry.uv.length
      + entry.normal.length;
    if (characters + entryCharacters > maxCharacters) continue;
    entries.push(entry);
    characters += entryCharacters;
  }

  return { version: 1, entries };
}

export function importTerrainCsgCache(data: TerrainCsgCacheSaveData | undefined) {
  clearTerrainCsgCache();
  if (!data || !Array.isArray(data.entries)) return;

  for (const entry of data.entries) {
    if (!entry || typeof entry.key !== 'string') continue;
    if (typeof entry.position !== 'string' || typeof entry.uv !== 'string' || typeof entry.normal !== 'string') continue;

    try {
      setCachedTerrainCsg(entry.key, {
        position: decodeFloat32(entry.position),
        uv: decodeFloat32(entry.uv),
        normal: decodeFloat32(entry.normal),
      });
    } catch {
      continue;
    }
  }
}
