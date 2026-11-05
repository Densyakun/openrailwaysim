import { proxy } from "valtio";

/**
 * 3Dシーン上の項目ごとの表示設定。
 * FeatureCollection の表示設定とは独立して扱う。
 */
export const sceneVisibilityState = proxy<{
  showTrackModels: boolean;
  showTerrains: boolean;
  showBuildings: boolean;
  showPlatforms: boolean;
}>({
  showTrackModels: true,
  showTerrains: true,
  showBuildings: true,
  showPlatforms: true,
});
