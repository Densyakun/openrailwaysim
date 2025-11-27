import * as THREE from 'three'
import EventEmitter from "events"
import { WebSocket as WebSocketInNode } from "ws"
import { BodySupporterJoint, Joint, SerializableBodySupporterJoint, SerializableJoint, SerializableTrain, SerializableTrainFormat, Train, TrainFormat, UIOneHandleMasterControllerConfig, getPointOnTrackByTrain, placeTrain, updateTrainOnTime } from "./trains";
import { FeatureCollection, Position } from "geojson";
import { SerializableTrack, SerializableTransitionCurve, SerializableTransitionCurveSegment, Switch, Track, TransitionCurve, TransitionCurveSegment } from './tracks';
import { HeightmapType } from './terrain';
import { Diagram } from './diagram';
import { MessageCode, MessageValueMap } from './ws';

export type GameStateType = {
  data: SaveDataType;
};

export type SaveDataType = {
  originCoordinate: Position;
  terrains: { [key: string]: { [key: string]: HeightmapType } };
  featureCollections: { [key: string]: { value: FeatureCollection } };
  tracks: { [key: string]: Track | TransitionCurve };
  switches: { [key: string]: Switch };
  trainFormats: { [key: string]: TrainFormat };
  trains: { [key: string]: Train };
  /**
   * Trainを文字列で分類する。
   * 運行系統と車両基地毎にまとめるのが望ましい。
   * 車種毎に停止位置と許容範囲を設定するために必要。
   * 列車にダイヤを自動で割り当てるために必要。
   */
  trainGroups: { [key: string]: string[] };
  uiOneHandleMasterControllerConfigs: { [key: string]: UIOneHandleMasterControllerConfig };
  nowDate: number;
  diagrams: { [key: string]: Diagram };
};

// TODO Pathの親世代のパスに対して子のパスの型推論が正しく行われないのを修正する
// Prevent infinite recursion in types with circular references by limiting recursion depth
export type Path<T, D extends number = 6> = [D] extends [never]
  ? []
  : T extends object
  ? {
    [K in Extract<keyof T, string | number>]:
    T[K] extends object
    ? [K] | [K, ...Path<T[K], Prev[D]>]
    : [K]
  }[Extract<keyof T, string | number>]
  : [];

// Helper type to decrement depth
type Prev = [never, 0, 1, 2, 3, 4, 5, 6];

export type PathValue<
  T,
  P extends readonly (string | number)[]
> = P extends [infer K, ...infer R]
  ? K extends keyof T
  ? R extends []
  ? T[K]
  : R extends (string | number)[]
  ? PathValue<T[K], R>
  : never
  : never
  : T;

export type SerializableSaveDataType = {
  originCoordinate: Position;
  terrains: { [key: string]: { [key: string]: HeightmapType } };
  featureCollections: { [key: string]: { value: FeatureCollection } };
  tracks: { [key: string]: SerializableTrack | SerializableTransitionCurve };
  switches: { [key: string]: Switch };
  trainFormats: { [key: string]: SerializableTrainFormat };
  trains: { [key: string]: SerializableTrain };
  trainGroups: { [key: string]: string[] };
  uiOneHandleMasterControllerConfigs: { [key: string]: UIOneHandleMasterControllerConfig };
  nowDate: number;
  diagrams: { [key: string]: Diagram };
};

export type SerializableEuler = [number, number, number, THREE.EulerOrder];

export function getNewSaveData() {
  const data: SaveDataType = {
    originCoordinate: [139.7, 35.691],
    terrains: {},
    featureCollections: {},
    tracks: {},
    switches: {},
    trainFormats: {},
    trains: {},
    trainGroups: {},
    uiOneHandleMasterControllerConfigs: {},
    nowDate: Date.now(),
    diagrams: {},
  };

  return data;
}

export const saveDataTypeId = "saveData";
export const tracksObjectTypeId = "tracksObject";
export const trackTypeId = "track";
export const transitionCurveSegmentArrayTypeId = "transitionCurveSegmentArray";
export const transitionCurveSegmentTypeId = "transitionCurveSegment";
export const trainFormatsObjectTypeId = "trainFormatsObject";
export const trainFormatTypeId = "trainFormat";
export const trainsObjectTypeId = "trainsObject";
export const trainTypeId = "train";
/*export const axleArrayTypeId = "axleArray";
export const axleTypeId = "axle";
export const otherBodyArrayTypeId = "otherBodyArray";
export const otherBodyTypeId = "otherBody";*/
export const bodySupporterJointArrayTypeId = "bodySupporterJointArray";
export const bodySupporterJointTypeId = "bodySupporterJoint";
export const jointArrayTypeId = "jointArray";
export const jointTypeId = "joint";
export const threeVector3TypeId = "THREE.Vector3";
export const threeEulerTypeId = "THREE.Euler";

export function getTypeIdByPath(path: Path<SerializableSaveDataType>) {
  if (!path.length) return saveDataTypeId;
  if (path[0] === "tracks") {
    if (path.length === 1) return tracksObjectTypeId;
    if (path.length === 2) return trackTypeId;
    if (
      path[2] === "position"
      || path[2] === "endPosition"
    ) return threeVector3TypeId;
    if (path[2] === "transitionCurves") {
      if (path.length === 3) return transitionCurveSegmentArrayTypeId;
      if (path.length === 4) return transitionCurveSegmentTypeId;
      if (path[4] === "position") return threeVector3TypeId;
    }
  }
  if (path[0] === "trainFormats") {
    if (path.length === 1) return trainFormatsObjectTypeId;
    if (path.length === 2) return trainFormatTypeId;
    if (path[2] === "bodySupporterJoints") {
      if (path.length === 3) return bodySupporterJointArrayTypeId;
      if (path.length === 4) return bodySupporterJointTypeId;
      if (
        path[4] === "otherBodyPosition"
        || path[4] === "bogiePosition"
      ) return threeVector3TypeId;
    } else if (path[2] === "otherJoints") {
      if (path.length === 3) return jointArrayTypeId;
      if (path.length === 4) return jointTypeId;
      if (
        path[4] === "positionA"
        || path[4] === "positionB"
      ) return threeVector3TypeId;
    }
  }
  if (path[0] === "trains") {
    if (path.length === 1) return trainsObjectTypeId;
    if (path.length === 2) return trainTypeId;
  }
  return "";
}

export function toSerializableSaveData(type: string, value: any, data: SaveDataType): any {
  if (type === saveDataTypeId) {
    const saveData: SaveDataType = value;

    const serializableSaveData: SerializableSaveDataType = {
      ...saveData,
      tracks: toSerializableSaveData(tracksObjectTypeId, saveData.tracks, data) as { [key: string]: SerializableTrack | SerializableTransitionCurve },
      trainFormats: toSerializableSaveData(trainFormatsObjectTypeId, saveData.trainFormats, data) as { [key: string]: SerializableTrainFormat },
      trains: toSerializableSaveData(trainsObjectTypeId, saveData.trains, data) as { [key: string]: SerializableTrain },
    };

    return serializableSaveData;
  } else if (type === tracksObjectTypeId) {
    const tracks: { [key: string]: Track | TransitionCurve } = value;
    const serializableTracks: { [key: string]: SerializableTrack | SerializableTransitionCurve } = {};

    Object.keys(tracks).forEach(id => serializableTracks[id] = toSerializableSaveData(trackTypeId, tracks[id], data) as SerializableTrack | SerializableTransitionCurve);

    return serializableTracks;
  } else if (type === trackTypeId) {
    const {
      position,
      rotationY,
      length,
      radius,
      gradients,
      idOfTrackOrSwitchConnectedFromStart,
      idOfTrackOrSwitchConnectedFromEnd,
      connectedFromStartIsTrack,
      connectedFromEndIsTrack,
      connectedFromStartIsToEnd,
      connectedFromEndIsToEnd,
      beginCant,
      endCant,
      trackModels,
    }: Track = value;

    const serializableTrack: SerializableTrack = {
      position: toSerializableSaveData(threeVector3TypeId, position, data) as THREE.Vector3Tuple,
      rotationY,
      length,
      radius,
      gradients,
      idOfTrackOrSwitchConnectedFromStart,
      idOfTrackOrSwitchConnectedFromEnd,
      connectedFromStartIsTrack,
      connectedFromEndIsTrack,
      connectedFromStartIsToEnd,
      connectedFromEndIsToEnd,
      beginCant: beginCant,
      endCant: endCant,
      trackModels,
    };

    if ((value as TransitionCurve).endPosition === undefined)
      return serializableTrack;
    else {
      const {
        beginCurvature,
        endCurvature,
        endPosition,
        endRotationY,
        transitionCurves,
        curveDirection,
      } = value as TransitionCurve;

      const serializableTransitionCurve: SerializableTransitionCurve = {
        ...serializableTrack,
        beginCurvature,
        endCurvature,
        endPosition: toSerializableSaveData(threeVector3TypeId, endPosition, data) as THREE.Vector3Tuple,
        endRotationY,
        transitionCurves: toSerializableSaveData(transitionCurveSegmentArrayTypeId, transitionCurves, data) as SerializableTransitionCurveSegment[],
        curveDirection,
      };

      return serializableTransitionCurve;
    }
  } else if (type === transitionCurveSegmentArrayTypeId) {
    const transitionCurves: TransitionCurveSegment[] = value;

    return transitionCurves.map(transitionCurve => toSerializableSaveData(transitionCurveSegmentTypeId, transitionCurve, data) as SerializableTransitionCurveSegment);
  } else if (type === transitionCurveSegmentTypeId) {
    const { position, rotationY, curvature }: TransitionCurveSegment = value;

    const serializableTransitionCurveSegment: SerializableTransitionCurveSegment = {
      position: toSerializableSaveData(threeVector3TypeId, position, data) as THREE.Vector3Tuple,
      rotationY: rotationY,
      curvature: curvature,
    };

    return serializableTransitionCurveSegment;
  } else if (type === trainFormatsObjectTypeId) {
    const trainFormats: { [key: string]: TrainFormat } = value;
    const serializableTrainFormats: { [key: string]: SerializableTrainFormat } = {};

    Object.keys(trainFormats).forEach(id => serializableTrainFormats[id] = toSerializableSaveData(trainFormatTypeId, trainFormats[id], data) as SerializableTrainFormat);

    return serializableTrainFormats;
  } else if (type === trainFormatTypeId) {
    const {
      bogies,
      otherBodyOffsets,
      otherBodyWeights,
      cabFormats,
      bodySupporterJoints,
      otherJoints,
    }: TrainFormat = value;

    const serializableTrainFormat: SerializableTrainFormat = {
      bogies,
      otherBodyOffsets,
      otherBodyWeights,
      cabFormats,
      bodySupporterJoints: toSerializableSaveData(bodySupporterJointArrayTypeId, bodySupporterJoints, data) as SerializableBodySupporterJoint[],
      otherJoints: toSerializableSaveData(jointArrayTypeId, otherJoints, data) as SerializableJoint[],
    };

    return serializableTrainFormat;
  } else if (type === trainsObjectTypeId) {
    const trains: { [key: string]: Train } = value;
    const serializableTrains: { [key: string]: SerializableTrain } = {};

    Object.keys(trains).forEach(id => serializableTrains[id] = toSerializableSaveData(trainTypeId, trains[id], data) as SerializableTrain);

    return serializableTrains;
  } else if (type === trainTypeId) {
    const train: Train = value;
    const {
      trainFormatId,
      cabStates,
      speed,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
    } = train;

    const { newDirectionIsReversed, newPointOnTrack } = getPointOnTrackByTrain(data, train);
    const serializableTrain: SerializableTrain = {
      trainFormatId,
      cabStates,
      speed,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
      pointOnTrack: newPointOnTrack,
      directionIsReversed: newDirectionIsReversed,
    };
    return serializableTrain;
  } else if (type === bodySupporterJointArrayTypeId) {
    const bodySupporterJoints: BodySupporterJoint[] = value;

    return bodySupporterJoints.map(bodySupporterJoint => toSerializableSaveData(bodySupporterJointTypeId, bodySupporterJoint, data) as SerializableBodySupporterJoint);
  } else if (type === bodySupporterJointTypeId) {
    const {
      otherBodyIndex,
      otherBodyPosition,
      bogieIndex,
      bogiePosition,
    }: BodySupporterJoint = value;

    const serializableBodySupporterJoint: SerializableBodySupporterJoint = {
      otherBodyIndex,
      otherBodyPosition: toSerializableSaveData(threeVector3TypeId, otherBodyPosition, data) as THREE.Vector3Tuple,
      bogieIndex,
      bogiePosition: toSerializableSaveData(threeVector3TypeId, bogiePosition, data) as THREE.Vector3Tuple,
    };

    return serializableBodySupporterJoint;
  } else if (type === jointArrayTypeId) {
    const joints: Joint[] = value;

    return joints.map(joint => toSerializableSaveData(jointTypeId, joint, data) as SerializableJoint);
  } else if (type === jointTypeId) {
    const {
      bodyIndexA,
      positionA,
      bodyIndexB,
      positionB,
    }: Joint = value;

    const serializableJoint: SerializableJoint = {
      bodyIndexA,
      positionA: toSerializableSaveData(threeVector3TypeId, positionA, data) as THREE.Vector3Tuple,
      bodyIndexB,
      positionB: toSerializableSaveData(threeVector3TypeId, positionB, data) as THREE.Vector3Tuple,
    };

    return serializableJoint;
  } else if (type === threeVector3TypeId) {
    const position: THREE.Vector3 = value;

    return position.toArray();
  } else if (type === threeEulerTypeId) {
    const rotation: THREE.Euler = value;

    return [rotation.x, rotation.y, rotation.z, rotation.order];
  }

  return value;
}

export function fromSerializableSaveData(type: string, value: any, data: SaveDataType): any {
  if (type === saveDataTypeId) {
    const serializableSaveData: SerializableSaveDataType = value;

    const saveData: SaveDataType = {
      ...getNewSaveData(),
      ...value,
      tracks: fromSerializableSaveData(tracksObjectTypeId, serializableSaveData.tracks, data) as { [key: string]: Track },
      trainFormats: fromSerializableSaveData(trainFormatsObjectTypeId, serializableSaveData.trainFormats, data) as { [key: string]: TrainFormat },
    };

    // 他のデータを参照するため、後からデシリアライズする
    saveData.trains = fromSerializableSaveData(trainsObjectTypeId, serializableSaveData.trains, saveData) as { [key: string]: Train };

    return saveData;
  } else if (type === tracksObjectTypeId) {
    const serializableTracks: { [key: string]: SerializableTrack } = value;
    const tracks: { [key: string]: Track } = {};

    Object.keys(serializableTracks).forEach(id =>
      tracks[id] = fromSerializableSaveData(trackTypeId, serializableTracks[id], data) as Track
    );

    return tracks;
  } else if (type === trackTypeId) {
    const {
      position,
      rotationY,
      length,
      radius,
      gradients,
      idOfTrackOrSwitchConnectedFromStart,
      idOfTrackOrSwitchConnectedFromEnd,
      connectedFromStartIsTrack,
      connectedFromEndIsTrack,
      connectedFromStartIsToEnd,
      connectedFromEndIsToEnd,
      beginCant,
      endCant,
      trackModels,
    }: SerializableTrack = value;

    const track: Track = {
      position: fromSerializableSaveData(threeVector3TypeId, position, data) as THREE.Vector3,
      rotationY,
      length,
      radius,
      gradients,
      idOfTrackOrSwitchConnectedFromStart,
      idOfTrackOrSwitchConnectedFromEnd,
      connectedFromStartIsTrack,
      connectedFromEndIsTrack,
      connectedFromStartIsToEnd,
      connectedFromEndIsToEnd,
      beginCant: beginCant,
      endCant: endCant,
      trackModels,
    };

    if ((value as SerializableTransitionCurve).endPosition === undefined)
      return track;
    else {
      const {
        beginCurvature,
        endCurvature,
        endPosition,
        endRotationY,
        transitionCurves,
        curveDirection,
      }: SerializableTransitionCurve = value;

      const transitionCurve: TransitionCurve = {
        ...track,
        beginCurvature,
        endCurvature,
        endPosition: fromSerializableSaveData(threeVector3TypeId, endPosition, data) as THREE.Vector3,
        endRotationY,
        transitionCurves: fromSerializableSaveData(transitionCurveSegmentArrayTypeId, transitionCurves, data) as TransitionCurveSegment[],
        curveDirection,
      };

      return transitionCurve;
    }
  } else if (type === transitionCurveSegmentArrayTypeId) {
    const serializableTransitionCurves: SerializableTransitionCurveSegment[] = value;

    const transitionCurves: TransitionCurveSegment[] = serializableTransitionCurves.map(transitionCurve =>
      fromSerializableSaveData(transitionCurveSegmentTypeId, transitionCurve, data)
    );

    return transitionCurves;
  } else if (type === transitionCurveSegmentTypeId) {
    const {
      position,
      rotationY,
      curvature,
    }: SerializableTransitionCurveSegment = value;

    const transitionCurveSegment: TransitionCurveSegment = {
      position: fromSerializableSaveData(threeVector3TypeId, position, data) as THREE.Vector3,
      rotationY,
      curvature,
    };

    return transitionCurveSegment;
  } else if (type === trainFormatsObjectTypeId) {
    const serializableTrainFormats: { [key: string]: SerializableTrainFormat } = value;
    const trainFormats: { [key: string]: TrainFormat } = {};

    Object.keys(serializableTrainFormats).forEach(id =>
      trainFormats[id] = fromSerializableSaveData(trainFormatTypeId, serializableTrainFormats[id], data) as TrainFormat
    );

    return trainFormats;
  } else if (type === trainFormatTypeId) {
    const {
      bogies,
      otherBodyOffsets,
      otherBodyWeights,
      cabFormats,
      bodySupporterJoints,
      otherJoints,
    }: SerializableTrainFormat = value;

    const trainFormat: TrainFormat = {
      bogies,
      otherBodyOffsets,
      otherBodyWeights,
      cabFormats,
      bodySupporterJoints: fromSerializableSaveData(bodySupporterJointArrayTypeId, bodySupporterJoints, data) as BodySupporterJoint[],
      otherJoints: fromSerializableSaveData(jointArrayTypeId, otherJoints, data) as Joint[],
    };

    return trainFormat;
  } else if (type === trainsObjectTypeId) {
    const serializableTrains: { [key: string]: SerializableTrain } = value;
    const trains: { [key: string]: Train } = {};

    Object.keys(serializableTrains).forEach(id => {
      // Nullable
      const train = fromSerializableSaveData(trainTypeId, serializableTrains[id], data) as Train | null;
      if (train) trains[id] = train;
    });

    return trains;
  } else if (type === trainTypeId) {
    const {
      trainFormatId,
      cabStates,
      speed,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
      pointOnTrack,
      directionIsReversed,
    }: SerializableTrain = value;

    const { train } = placeTrain(
      data,
      data.trainFormats[trainFormatId],
      pointOnTrack,
      directionIsReversed,
    );

    if (!train) return null;

    train.trainFormatId = trainFormatId;
    train.cabStates = cabStates;
    train.speed = speed;
    train.currentDiagramId = currentDiagramId;
    train.currentDiagramCurveIndex = currentDiagramCurveIndex;
    train.currentDiagramSectionIndex = currentDiagramSectionIndex;
    train.currentRouteIndex = currentRouteIndex;
    train.isStopping = isStopping;

    return train;
  } else if (type === bodySupporterJointArrayTypeId) {
    const serializableBodySupporterJoints: SerializableBodySupporterJoint[] = value;

    const bodySupporterJoints: BodySupporterJoint[] = serializableBodySupporterJoints.map(bodySupporterJoint =>
      fromSerializableSaveData(bodySupporterJointTypeId, bodySupporterJoint, data)
    );

    return bodySupporterJoints;
  } else if (type === bodySupporterJointTypeId) {
    const {
      otherBodyIndex,
      otherBodyPosition,
      bogieIndex,
      bogiePosition,
    }: SerializableBodySupporterJoint = value;

    const bodySupporterJoint: BodySupporterJoint = {
      otherBodyIndex,
      otherBodyPosition: fromSerializableSaveData(threeVector3TypeId, otherBodyPosition, data),
      bogieIndex,
      bogiePosition: fromSerializableSaveData(threeVector3TypeId, bogiePosition, data),
    };

    return bodySupporterJoint;
  } else if (type === jointArrayTypeId) {
    const serializableJoints: SerializableJoint[] = value;

    const joints: Joint[] = serializableJoints.map(joint =>
      fromSerializableSaveData(jointTypeId, joint, data)
    );

    return joints;
  } else if (type === jointTypeId) {
    const {
      bodyIndexA,
      positionA,
      bodyIndexB,
      positionB,
    }: SerializableJoint = value;

    const joint: Joint = {
      bodyIndexA,
      positionA: fromSerializableSaveData(threeVector3TypeId, positionA, data),
      bodyIndexB,
      positionB: fromSerializableSaveData(threeVector3TypeId, positionB, data),
    };

    return joint;
  } else if (type === threeVector3TypeId) {
    const position: THREE.Vector3Tuple = value;

    return new THREE.Vector3(...position);
  } else if (type === threeEulerTypeId) {
    const rotation: SerializableEuler = value;

    return new THREE.Euler(...rotation);
  }

  return value;
}

let timeRemainder = 0;

export function updateTime(saveData: SaveDataType, delta: number) {
  // Time
  timeRemainder += delta * 1000
  const deltaMilliseconds = Math.floor(timeRemainder)
  timeRemainder -= deltaMilliseconds
  saveData.nowDate += deltaMilliseconds

  // Trains
  Object.keys(saveData.trains).forEach(trainId => {
    const train = saveData.trains[trainId]

    updateTrainOnTime(saveData, train, delta)
  })
}

export type OnMessageInClient = <C extends MessageCode>(code: C, value: MessageValueMap[C], ws: WebSocket | WebSocket) => void;
export type OnMessageInServer = <C extends MessageCode>(code: C, value: MessageValueMap[C], ws: WebSocket | WebSocketInNode) => void;

export class MessageEmitter extends EventEmitter {
  isInvalidMessage: boolean

  constructor() {
    super()

    this.isInvalidMessage = false
  }

  emit(eventName: string | symbol, ...args: any[]): boolean {
    if (eventName === "message") {
      this.isInvalidMessage = true

      const result = super.emit(eventName, ...args)

      if (this.isInvalidMessage)
        console.log(`Received invalid message. id: ${args[0]}, value: ${JSON.stringify(args[1])}`)

      return result
    } else
      return super.emit(eventName, ...args)
  }
}
