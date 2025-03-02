import { proxy } from "valtio";
import { DiagramTrackRoute, TrainDiagramCurve } from "../diagram";

export const diagramsTabPanelState = proxy<{
  isShowTable: boolean;
  editingRouteMapsInDiagramId: string;
  editingTrainGroupsInDiagramId: string;
  editingDiagramCurvesInDiagramId: string;
  routeMap: DiagramTrackRoute[][];
  selectingRouteListIndex: number;
  selectingRouteIndex: number;
  tracksIsEditing: boolean;
  diagramCurves: TrainDiagramCurve[];
  selectingDiagramCurveIndex: number;
  selectingStationIndex: number;
}>({
  isShowTable: false,
  editingRouteMapsInDiagramId: "",
  editingTrainGroupsInDiagramId: "",
  editingDiagramCurvesInDiagramId: "",
  routeMap: [],
  selectingRouteListIndex: 0,
  selectingRouteIndex: -1,
  tracksIsEditing: false,
  diagramCurves: [],
  selectingDiagramCurveIndex: 0,
  selectingStationIndex: -1,
});

export function resetEditingDiagramState() {
  diagramsTabPanelState.routeMap = [];
  diagramsTabPanelState.selectingRouteListIndex = 0;
  diagramsTabPanelState.selectingRouteIndex = -1;
  diagramsTabPanelState.tracksIsEditing = false;

  diagramsTabPanelState.diagramCurves = [];
  diagramsTabPanelState.selectingDiagramCurveIndex = 0;
  diagramsTabPanelState.selectingStationIndex = -1;
}