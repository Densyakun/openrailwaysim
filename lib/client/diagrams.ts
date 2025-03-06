import { proxy } from "valtio";
import { DiagramSection, TrainDiagramCurve } from "../diagram";

export const diagramsTabPanelState = proxy<{
  isShowTable: boolean;
  editingSectionsInDiagramId: string;
  editingTrainGroupsInDiagramId: string;
  editingDiagramCurvesInDiagramId: string;
  sections: DiagramSection[];
  selectingDiagramSectionIndex: number;
  selectingRouteIndex: number;
  tracksIsEditing: boolean;
  diagramCurves: TrainDiagramCurve[];
  selectingDiagramCurveIndex: number;
  selectingDiagramSectionIndexInDiagramCurve: number;
}>({
  isShowTable: false,
  editingSectionsInDiagramId: "",
  editingTrainGroupsInDiagramId: "",
  editingDiagramCurvesInDiagramId: "",
  sections: [],
  selectingDiagramSectionIndex: 0,
  selectingRouteIndex: -1,
  tracksIsEditing: false,
  diagramCurves: [],
  selectingDiagramCurveIndex: 0,
  selectingDiagramSectionIndexInDiagramCurve: -1,
});

export function resetEditingDiagramState() {
  diagramsTabPanelState.sections = [];
  diagramsTabPanelState.selectingDiagramSectionIndex = 0;
  diagramsTabPanelState.selectingRouteIndex = -1;
  diagramsTabPanelState.tracksIsEditing = false;

  diagramsTabPanelState.diagramCurves = [];
  diagramsTabPanelState.selectingDiagramCurveIndex = 0;
  diagramsTabPanelState.selectingDiagramSectionIndexInDiagramCurve = -1;
}