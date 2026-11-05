import { proxy, useSnapshot } from "valtio";
import { guiState } from "./gui";

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

/**
 * 編集中のみ個別表示設定を適用し、非編集中はすべて表示する。
 */
export function useSceneVisibility() {
  const visibility = useSnapshot(sceneVisibilityState);
  const { selectedTab } = useSnapshot(guiState);
  const isOverrideActive = selectedTab === "tracks" || selectedTab === "featureCollections";

  return {
    showTrackModels: isOverrideActive ? visibility.showTrackModels : true,
    showTerrains: isOverrideActive ? visibility.showTerrains : true,
    showBuildings: isOverrideActive ? visibility.showBuildings : true,
    showPlatforms: isOverrideActive ? visibility.showPlatforms : true,
  };
}
