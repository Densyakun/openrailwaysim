import { describe, expect, it } from 'vitest';
import {
  clearTerrainCsgCache,
  exportTerrainCsgCache,
  getCachedTerrainCsg,
  importTerrainCsgCache,
  setCachedTerrainCsg,
} from '@/lib/terrainCsgCache';

describe('terrain CSG cache', () => {
  it('round-trips cached geometry', () => {
    clearTerrainCsgCache();
    const key = 'tile:1:2:step:4:zone@signature;';

    setCachedTerrainCsg(key, {
      position: new Float32Array([1, 2, 3]),
      uv: new Float32Array([0, 1]),
      normal: new Float32Array([0, 1, 0]),
    });

    const saveData = exportTerrainCsgCache();
    expect(saveData.entries).toHaveLength(1);

    clearTerrainCsgCache();
    expect(getCachedTerrainCsg(key)).toBeUndefined();

    importTerrainCsgCache(saveData);
    expect(Array.from(getCachedTerrainCsg(key)?.position ?? [])).toEqual([1, 2, 3]);
    expect(Array.from(getCachedTerrainCsg(key)?.uv ?? [])).toEqual([0, 1]);
  });
});
