import { proxy } from "valtio";
import { PointOnTrack } from "../tracks";
import { TrainFormat } from "../trains";

export const trainsState = proxy<{
  hoveredTrainId: string;
  hoveredBodyIndex: number;
  hoveredAxleIndex: number;
  activeTrainId: string;
  activeBodyIndex: number;
  selectedTrainId: string;
  selectedBodyIndex: number;
  isCameraFollowing: boolean;
  cameraOffset: { x: number; y: number; z: number };
}>({
  hoveredTrainId: "",
  hoveredBodyIndex: -1,
  hoveredAxleIndex: -1,
  activeTrainId: "",
  activeBodyIndex: -1,
  selectedTrainId: "",
  selectedBodyIndex: -1,
  isCameraFollowing: false,
  cameraOffset: { x: 0, y: 5, z: 12 }, // デフォルトオフセット (やや高め、後方から見下ろす視角)
});

export const trainsTabPanelState = proxy<{
  // Train format
  isShowTrainFormatTable: boolean;
  isAddingTrainFormat: boolean;
  newTrainFormatId: string;
  editingTrainFormatId: string;
  editingTrainFormat?: TrainFormat;
  selectedCarBodyIndex: number;
  selectedAxleIndex: number;
  selectedBodySupporterJointIndex: number;
  selectedOtherJointIndex: number;
  isShowOneHandleMasterControllerConfig: boolean;
  isSelectingCarBodyA: boolean;
  isSelectingCarBodyB: boolean;
  isSelectingCarBodyToBodySupporterJoint: boolean;
  isSyncPreview: boolean;

  // Train
  isShowTrainTable: boolean;
  selectedTrainGroup: string;
  isAddingTrain: boolean;
  newTrainId: string;
  trainFormatId: string;
  directionIsReversed: boolean;
  pointOnTrack?: PointOnTrack;
  trainIsDeadEnd: boolean;
}>({
  // Train format
  isShowTrainFormatTable: false,
  isAddingTrainFormat: false,
  newTrainFormatId: "",
  editingTrainFormatId: "",
  selectedCarBodyIndex: -1,
  selectedAxleIndex: -1,
  selectedBodySupporterJointIndex: -1,
  selectedOtherJointIndex: -1,
  isShowOneHandleMasterControllerConfig: false,
  isSelectingCarBodyA: false,
  isSelectingCarBodyB: false,
  isSelectingCarBodyToBodySupporterJoint: false,
  isSyncPreview: false,

  // Train
  isShowTrainTable: false,
  selectedTrainGroup: "",
  isAddingTrain: false,
  newTrainId: "",
  trainFormatId: "",
  directionIsReversed: false,
  trainIsDeadEnd: false,
});

export function resetEditingTrainState() {
  trainsTabPanelState.isAddingTrainFormat = false;
  trainsTabPanelState.newTrainFormatId = "";
  trainsTabPanelState.editingTrainFormatId = "";
  trainsTabPanelState.editingTrainFormat = undefined;
  trainsTabPanelState.selectedCarBodyIndex = -1;
  trainsTabPanelState.selectedAxleIndex = -1;
  trainsTabPanelState.selectedBodySupporterJointIndex = -1;
  trainsTabPanelState.selectedOtherJointIndex = -1;
  trainsTabPanelState.isShowOneHandleMasterControllerConfig = false;
  trainsTabPanelState.isSelectingCarBodyA = false;
  trainsTabPanelState.isSelectingCarBodyB = false;
  trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint = false;
  trainsTabPanelState.isSyncPreview = false;

  trainsTabPanelState.isAddingTrain = false;
  trainsTabPanelState.newTrainId = "";
  trainsTabPanelState.trainFormatId = "";
  trainsTabPanelState.pointOnTrack = undefined;
  trainsTabPanelState.directionIsReversed = false;
  trainsTabPanelState.trainIsDeadEnd = false;
}

export function triggerPreviewUpdate() {
  if (trainsTabPanelState.editingTrainFormat) {
    trainsTabPanelState.editingTrainFormat = JSON.parse(JSON.stringify(trainsTabPanelState.editingTrainFormat));
  }
}
 
export function resetSelectedTrainState() {
  trainsState.selectedTrainId = "";
  trainsState.selectedBodyIndex = -1;
  trainsState.isCameraFollowing = false;
  trainsState.cameraOffset = { x: 0, y: 5, z: 12 };
}
