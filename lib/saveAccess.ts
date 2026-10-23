import {
  getSaveData, normalizeSaveData, ORSAppSaveDataType, storeSaveData,
} from './save'

export type SaveDataPath = (string | number)[]

export type SaveDataEditResult = {
  path: SaveDataPath;
  value: unknown;
}

const saveRootKeys = new Set([
  'originCoordinate',
  'terrains',
  'featureCollections',
  'tracks',
  'switches',
  'trainFormats',
  'trains',
  'trainGroups',
  'oneHandleMasterControllerUIConfigs',
  'nowDate',
  'diagrams',
  'constructionZones',
  'tunnels',
  'platforms',
  'worldModels',
])

const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor'])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * MCP から受け取ったパスを検証する。
 * セーブデータのトップレベルキー以外や、プロトタイプ汚染につながるキーは拒否する。
 */
export function parseSaveDataPath(path: unknown): SaveDataPath {
  if (!Array.isArray(path) || !path.length)
    throw new Error('path must be a non-empty array of strings or numbers');

  const result: SaveDataPath = [];

  path.forEach((key, index) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`path[${index}] must be a string or number`);

    const text = String(key);

    if (!text.length)
      throw new Error(`path[${index}] must not be empty`);

    if (forbiddenKeys.has(text))
      throw new Error(`path[${index}] is not allowed`);

    if (index === 0 && !saveRootKeys.has(text))
      throw new Error(`unknown save data root: ${text}`);

    result.push(key);
  });

  return result;
}

function readPath(root: unknown, path: SaveDataPath) {
  let current: unknown = root;

  for (const key of path) {
    if (!isObject(current)) return undefined;

    if (Array.isArray(current)) {
      const index = Number(key);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
    } else {
      current = current[String(key)];
    }
  }

  return current;
}

function writePath(root: ORSAppSaveDataType, path: SaveDataPath, value: unknown) {
  if (path.length === 1) {
    (root as unknown as Record<string, unknown>)[String(path[0])] = value;
    return;
  }

  let parent: unknown = root;

  for (let index = 0; index < path.length - 1; index++) {
    if (!isObject(parent))
      throw new Error(`parent path not found: ${path.slice(0, index + 1).join('.')}`);

    if (Array.isArray(parent)) {
      const arrayIndex = Number(path[index]);
      if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || parent.length <= arrayIndex)
        throw new Error(`array index out of range: ${path[index]}`);
      parent = parent[arrayIndex];
    } else {
      parent = parent[String(path[index])];
    }
  }

  if (!isObject(parent))
    throw new Error(`parent path not found: ${path.slice(0, -1).join('.')}`);

  const last = path[path.length - 1];

  if (Array.isArray(parent)) {
    const arrayIndex = Number(last);
    if (!Number.isInteger(arrayIndex) || arrayIndex < 0)
      throw new Error(`invalid array index: ${String(last)}`);
    parent[arrayIndex] = value;
  } else {
    parent[String(last)] = value;
  }
}

function deletePath(root: ORSAppSaveDataType, path: SaveDataPath) {
  let parent: unknown = root;

  for (let index = 0; index < path.length - 1; index++) {
    if (!isObject(parent))
      throw new Error(`parent path not found: ${path.slice(0, index + 1).join('.')}`);

    if (Array.isArray(parent)) {
      const arrayIndex = Number(path[index]);
      if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || parent.length <= arrayIndex)
        throw new Error(`array index out of range: ${path[index]}`);
      parent = parent[arrayIndex];
    } else {
      parent = parent[String(path[index])];
    }
  }

  if (!isObject(parent))
    throw new Error(`parent path not found: ${path.slice(0, -1).join('.')}`);

  const last = path[path.length - 1];

  if (Array.isArray(parent)) {
    const arrayIndex = Number(last);
    if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || parent.length <= arrayIndex)
      throw new Error(`array index out of range: ${String(last)}`);
    parent.splice(arrayIndex, 1);
  } else {
    delete parent[String(last)];
  }
}

/**
 * 現在のストアをセーブデータ形式に変換して、指定パスの値を返す。
 */
export function getSaveValue(path: unknown) {
  const savePath = parseSaveDataPath(path);
  return readPath(getSaveData(), savePath);
}

/**
 * セーブデータ形式の指定パスを更新し、ストアへ反映する。
 * 反映後はストア全体が置き換わるため、呼び出し側でクライアントへ状態を再送信すること。
 */
export function setSaveValue(path: unknown, value: unknown): SaveDataEditResult {
  const savePath = parseSaveDataPath(path);
  const saveData = getSaveData();

  writePath(saveData, savePath, value);
  storeSaveData(normalizeSaveData(saveData));

  return {
    path: savePath,
    value: readPath(getSaveData(), savePath),
  };
}

/**
 * セーブデータ形式の指定パスを削除し、ストアへ反映する。
 */
export function removeSaveValue(path: unknown): SaveDataEditResult {
  const savePath = parseSaveDataPath(path);
  const saveData = getSaveData();

  deletePath(saveData, savePath);
  storeSaveData(normalizeSaveData(saveData));

  return {
    path: savePath,
    value: readPath(getSaveData(), savePath),
  };
}

/**
 * セーブデータの概要。terrains などの巨大なデータは含めない。
 */
export function getSaveSummary() {
  const saveData = getSaveData();

  const count = (value: unknown) =>
    isObject(value) && !Array.isArray(value) ? Object.keys(value).length : 0;

  const countTerrainTiles = (terrains: unknown) => {
    if (!isObject(terrains)) return 0;

    return Object.values(terrains).reduce<number>((total, tiles) =>
      total + count(tiles), 0
    );
  };

  return {
    originCoordinate: saveData.originCoordinate,
    nowDate: saveData.nowDate,
    counts: {
      terrainTiles: countTerrainTiles(saveData.terrains),
      featureCollections: count(saveData.featureCollections),
      tracks: count(saveData.tracks),
      switches: count(saveData.switches),
      trainFormats: count(saveData.trainFormats),
      trains: count(saveData.trains),
      trainGroups: count(saveData.trainGroups),
      diagrams: count(saveData.diagrams),
      constructionZones: count(saveData.constructionZones),
      tunnels: count(saveData.tunnels),
      platforms: count(saveData.platforms),
      worldModels: count(saveData.worldModels),
    },
    keys: Object.keys(saveData),
  };
}
