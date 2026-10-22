import { proxy } from 'valtio'

/**
 * 建物の手続き生成設定。
 * 変更すると建物メッシュが再生成される（キャッシュは使わない）。
 */
export const buildingGenerationSettings = proxy<{
  followTerrain: boolean;
  foundationDepth: number;
  floorHeight: number;
  seed: number;
  variation: boolean;
}>({
  followTerrain: true,
  foundationDepth: 2,
  floorHeight: 3,
  seed: 1,
  variation: true,
})
