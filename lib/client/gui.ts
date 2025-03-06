import { proxy } from "valtio";
import { trainsState } from "./trains";
import { diagramsTabPanelState } from "./diagrams";

export const guiState = proxy<{
  selectedTab: string;
  alignItems: string;
}>({
  selectedTab: "",
  alignItems: "center",
});

export function lightingIsForEditing(selectedTab: string) {
  return selectedTab === "terrains"
    || selectedTab === "featureCollections"
    || selectedTab === "tracks"
    || selectedTab === "switches"
    || selectedTab === "trains" && trainsState.activeBodyIndex === -1
    || selectedTab === "diagrams" && diagramsTabPanelState.editingSectionsInDiagramId;
}
