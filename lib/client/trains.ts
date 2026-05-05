import { proxy } from "valtio";
import { PointOnTrack } from "../tracks";
import { Train, TrainFormat } from "../trains";

export const trainsState = proxy<{
  hoveredTrainId: string;
  hoveredBodyIndex: number;
  activeTrainId: string;
  activeBodyIndex: number;
}>({
  hoveredTrainId: "",
  hoveredBodyIndex: -1,
  activeTrainId: "",
  activeBodyIndex: -1,
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

  // Train
  isShowTrainTable: boolean;
  selectedTrainGroup: string;
  isAddingTrain: boolean;
  newTrainId: string;
  editingTrainId: string;
  editingTrain?: Train;
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

  // Train
  isShowTrainTable: false,
  selectedTrainGroup: "",
  isAddingTrain: false,
  newTrainId: "",
  editingTrainId: "",
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

  trainsTabPanelState.isAddingTrain = false;
  trainsTabPanelState.newTrainId = "";
  trainsTabPanelState.editingTrainId = "";
  trainsTabPanelState.editingTrain = undefined;
  trainsTabPanelState.trainFormatId = "";
  trainsTabPanelState.pointOnTrack = undefined;
  trainsTabPanelState.directionIsReversed = false;
  trainsTabPanelState.trainIsDeadEnd = false;
}
