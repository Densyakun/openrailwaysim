import { proxy } from "valtio";
import { DiagramTrackRoute } from "../diagram";

export const diagramsTabPanelState = proxy<{
  isShowTable: boolean;
  editingRouteMapsInDiagramId: string;
  editingTrainGroupsInDiagramId: string;
  editingDiagramCurvesInDiagramId: string;
  routeMap: DiagramTrackRoute[][];
  selectingRoutesIndex: number;
  selectingRouteIndex: number;
  tracksIsEditing: boolean;
}>({
  isShowTable: false,
  editingRouteMapsInDiagramId: "",
  editingTrainGroupsInDiagramId: "",
  editingDiagramCurvesInDiagramId: "",
  routeMap: [],
  selectingRoutesIndex: 0,
  selectingRouteIndex: -1,
  tracksIsEditing: false,
});

export function resetEditingDiagramState() {
  diagramsTabPanelState.routeMap = [];
  diagramsTabPanelState.selectingRoutesIndex = 0;
  diagramsTabPanelState.selectingRouteIndex = -1;
  diagramsTabPanelState.tracksIsEditing = false;
}