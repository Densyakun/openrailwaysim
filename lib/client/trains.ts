import { proxy } from "valtio";
import { PointOnTrack } from "../tracks";
import { BodySupporterJoint, ControlStandType, Joint, Train } from "../trains";

export const trainsTabPanelState = proxy<{
  isShowTable: boolean;
  selectedTrainGroup: string;
  isAddingTrain: boolean;
  editingTrainId: string;
  newTrainId: string;
  pointOnTrack?: PointOnTrack;
  selectedCarBodyIndex: number;
  selectedAxleIndex: number;
  selectedBodySupporterJointIndex: number;
  selectedOtherJointIndex: number;
  bogieOffsets: number[];
  bogieWeights: number[];
  axleTable: {
    z: number,
    diameter: number,
    hasMotor: boolean,
  }[][];
  otherBodyOffsets: number[];
  otherBodyWeights: number[];
  controlStands: ControlStandType[][];
  bodySupporterJoints: BodySupporterJoint[];
  otherJoints: Joint[];
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
  isAddingTrain: false,
  editingTrainId: "",
  newTrainId: "",
  selectedCarBodyIndex: -1,
  selectedAxleIndex: -1,
  selectedBodySupporterJointIndex: -1,
  selectedOtherJointIndex: -1,
  bogieOffsets: [],
  bogieWeights: [],
  axleTable: [],
  otherBodyOffsets: [],
  otherBodyWeights: [],
  controlStands: [],
  bodySupporterJoints: [],
  otherJoints: [],
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
  trainsTabPanelState.bogieOffsets = [];
  trainsTabPanelState.bogieWeights = [];
  trainsTabPanelState.axleTable = [];
  trainsTabPanelState.otherBodyOffsets = [];
  trainsTabPanelState.otherBodyWeights = [];
  trainsTabPanelState.controlStands = [];
  trainsTabPanelState.bodySupporterJoints = [];
  trainsTabPanelState.otherJoints = [];
  trainsTabPanelState.directionIsReversed = false;
  trainsTabPanelState.editingTrain = undefined;
  trainsTabPanelState.trainIsDeadEnd = false;
}