import { proxy } from "valtio";

export const terrainsState = proxy<{
  hoveredTileX: number;
  hoveredTileY: number;
  selectedTileX: number;
  selectedTileY: number;
}>({
  hoveredTileX: -1,
  hoveredTileY: -1,
  selectedTileX: -1,
  selectedTileY: -1,
});
