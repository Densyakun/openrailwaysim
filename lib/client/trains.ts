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
  isShowTable: boolean;
  selectedTrainGroup: string;
  isAddingTrainFormat: boolean;
  editingTrainFormatId: string; // TODO 編集機能（今回の目的→次のコミットで実装）
  newTrainId: string;
  pointOnTrack?: PointOnTrack;
  selectedCarBodyIndex: number;
  selectedAxleIndex: number;
  selectedBodySupporterJointIndex: number;
  selectedOtherJointIndex: number;
  editingTrainFormat?: TrainFormat; // TODO
  trainFormatId: string; // TODO

  // TODO
  //isAddingTrain: boolean;
  //editingTrainId: string;
  directionIsReversed: boolean;
  editingTrain?: Train;
  trainIsDeadEnd: boolean;
  isShowOneHandleMasterControllerConfig: boolean;
  isSelectingCarBodyA: boolean;
  isSelectingCarBodyB: boolean;
  isSelectingCarBodyToBodySupporterJoint: boolean;
}>({
  isShowTable: false,
  selectedTrainGroup: "",
  isAddingTrainFormat: false,
  editingTrainFormatId: "",
  newTrainId: "",
  selectedCarBodyIndex: -1,
  selectedAxleIndex: -1,
  selectedBodySupporterJointIndex: -1,
  selectedOtherJointIndex: -1,
  trainFormatId: "",
  directionIsReversed: false,
  trainIsDeadEnd: false,
  isShowOneHandleMasterControllerConfig: false,
  isSelectingCarBodyA: false,
  isSelectingCarBodyB: false,
  isSelectingCarBodyToBodySupporterJoint: false,
});

export function resetEditingTrainState() {
  trainsTabPanelState.newTrainId = "";
  trainsTabPanelState.pointOnTrack = undefined;
  /*trainsTabPanelState.editingTrainFormat = {
    bogies: [],
  };*/

  //trainsTabPanelState.editingTrainId = "";
  trainsTabPanelState.directionIsReversed = false;
  trainsTabPanelState.editingTrain = undefined;
  trainsTabPanelState.trainIsDeadEnd = false;
}