import { proxy } from "valtio";

export const terrainsState = proxy<{
  hoveredTileX: number;
  hoveredTileY: number;
  selectedTileX: number;
  selectedTileY: number;
  isVisible: boolean;
}>({
  hoveredTileX: -1,
  hoveredTileY: -1,
  selectedTileX: -1,
  selectedTileY: -1,
  isVisible: true,
});

export const terrainLodState = proxy<{
  cameraX: number;
  cameraZ: number;
}>({
  cameraX: 0,
  cameraZ: 0,
});
