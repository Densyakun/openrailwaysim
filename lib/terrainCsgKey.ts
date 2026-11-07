import { HeightmapType, heightmapSize } from './terrain';

export type TerrainCsgBrushKey = {
  id: string;
  signature: string;
};

const heightmapHashes = new WeakMap<object, string>();

export function getHeightmapHash(heightmap: HeightmapType | undefined) {
  if (!heightmap) return '0';

  const cached = heightmapHashes.get(heightmap as object);
  if (cached) return cached;

  let hash = 2166136261;
  for (let y = 0; y < heightmapSize; y++) {
    for (let x = 0; x < heightmapSize; x++) {
      const value = heightmap[y]?.[x];
      const quantized = value === null || value === undefined
        ? -2147483648
        : Math.round(value * 100);
      hash ^= quantized;
      hash = Math.imul(hash, 16777619);
    }
  }

  const result = (hash >>> 0).toString(36);
  heightmapHashes.set(heightmap as object, result);
  return result;
}

export function createTerrainCsgKey(params: {
  tileX: number;
  tileY: number;
  heightmap: HeightmapType;
  eastHeightmap?: HeightmapType;
  southHeightmap?: HeightmapType;
  southeastHeightmap?: HeightmapType;
  step: number;
  brushes: TerrainCsgBrushKey[];
}) {
  const brushKey = params.brushes
    .map(brush => `${brush.id}@${brush.signature};`)
    .join('');
  const heightmapHash = getHeightmapHash(params.heightmap);
  const neighborKey = [
    getHeightmapHash(params.eastHeightmap),
    getHeightmapHash(params.southHeightmap),
    getHeightmapHash(params.southeastHeightmap),
  ].join(':');

  return [
    params.tileX,
    params.tileY,
    heightmapHash,
    neighborKey,
    params.step,
    brushKey,
  ].join(':');
}
