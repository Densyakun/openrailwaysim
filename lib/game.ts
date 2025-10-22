import * as THREE from 'three'
import EventEmitter from "events"
import { WebSocket as WebSocketInNode } from "ws"
import { Axle, BodySupporterJoint, Bogie, Joint, OtherBody, SerializableAxle, SerializableBodySupporterJoint, SerializableBogie, SerializableJoint, SerializableOtherBody, SerializableTrain, Train, UIOneHandleMasterControllerConfig, createTrain, updateTrainOnTime } from "./trains";
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

// Prevent infinite recursion in types with circular references by limiting recursion depth
export type Path<T, D extends number = 6> = [D] extends [never]
  ? []
  : T extends object
  ? {
    [K in keyof T]:
    K extends string | number
    ? T[K] extends object
    ? [K] | [K, ...Path<T[K], Prev[D]>]
    : [K]
    : never
  }[keyof T]
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

export type SerializableSaveDataType = { [key: string]: any } & {
  originCoordinate: Position;
  terrains: { [key: string]: { [key: string]: HeightmapType } };
  featureCollections: { [key: string]: { value: FeatureCollection } };
  tracks: { [key: string]: SerializableTrack | SerializableTransitionCurve };
  switches: { [key: string]: Switch };
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
export const trainsObjectTypeId = "trainsObject";
export const trainTypeId = "train";
export const bogieArrayTypeId = "bogieArray";
export const bogieTypeId = "bogie";
export const axleArrayTypeId = "axleArray";
export const axleTypeId = "axle";
export const otherBodyArrayTypeId = "otherBodyArray";
export const otherBodyTypeId = "otherBody";
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
  if (path[0] === "trains") {
    if (path.length === 1) return trainsObjectTypeId;
    if (path.length === 2) return trainTypeId;
    if (path[2] === "bogies") {
      if (path.length === 3) return bogieArrayTypeId;
      if (path.length === 4) return bogieTypeId;
      if (path[4] === "position") return threeVector3TypeId;
      if (path[4] === "rotation") return threeEulerTypeId;
      if (path[4] === "axles") {
        if (path.length === 5) return axleArrayTypeId;
        if (path.length === 6) return axleTypeId;
        if (path[6] === "position") return threeVector3TypeId;
        if (path[6] === "rotation") return threeEulerTypeId;
      }
    } else if (path[2] === "otherBodies") {
      if (path.length === 3) return otherBodyArrayTypeId;
      if (path.length === 4) return otherBodyTypeId;
      if (path[4] === "position") return threeVector3TypeId;
      if (path[4] === "rotation") return threeEulerTypeId;
    } else if (path[2] === "bodySupporterJoints") {
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
  return "";
}

export function toSerializableSaveData(type: string, value: any): any {
  if (type === saveDataTypeId) {
    const saveData: SaveDataType = value;

    return {
      ...saveData,
      tracks: toSerializableSaveData(tracksObjectTypeId, saveData.tracks) as { [key: string]: SerializableTrack | SerializableTransitionCurve },
      trains: toSerializableSaveData(trainsObjectTypeId, saveData.trains) as { [key: string]: SerializableTrain },
    } as SerializableSaveDataType;
  } else if (type === tracksObjectTypeId) {
    const tracks: { [key: string]: Track | TransitionCurve } = value;
    const serializableTracks: { [key: string]: SerializableTrack | SerializableTransitionCurve } = {};

    Object.keys(tracks).forEach(id => serializableTracks[id] = toSerializableSaveData(trackTypeId, tracks[id]) as SerializableTrack | SerializableTransitionCurve);

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
      position: toSerializableSaveData(threeVector3TypeId, position) as THREE.Vector3Tuple,
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

      return {
        ...serializableTrack,
        beginCurvature,
        endCurvature,
        endPosition: toSerializableSaveData(threeVector3TypeId, endPosition) as THREE.Vector3Tuple,
        endRotationY,
        transitionCurves: toSerializableSaveData(transitionCurveSegmentArrayTypeId, transitionCurves) as SerializableTransitionCurveSegment[],
        curveDirection,
      } as SerializableTransitionCurve;
    }
  } else if (type === transitionCurveSegmentArrayTypeId) {
    const transitionCurves: TransitionCurveSegment[] = value;

    return transitionCurves.map(transitionCurve => toSerializableSaveData(transitionCurveSegmentTypeId, transitionCurve) as SerializableTransitionCurveSegment);
  } else if (type === transitionCurveSegmentTypeId) {
    const { position, rotationY, curvature }: TransitionCurveSegment = value;

    return {
      position: toSerializableSaveData(threeVector3TypeId, position) as THREE.Vector3Tuple,
      rotationY: rotationY,
      curvature: curvature,
    } as SerializableTransitionCurveSegment;
  } else if (type === trainsObjectTypeId) {
    const trains: { [key: string]: Train } = value;
    const serializableTrains: { [key: string]: SerializableTrain } = {};

    Object.keys(trains).forEach(id => serializableTrains[id] = toSerializableSaveData(trainTypeId, trains[id]) as SerializableTrain);

    return serializableTrains;
  } else if (type === trainTypeId) {
    const {
      bogies,
      otherBodies,
      bodySupporterJoints,
      otherJoints,
      speed,
      motors,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
    }: Train = value;

    return {
      bogies: toSerializableSaveData(bogieArrayTypeId, bogies) as SerializableBogie[],
      otherBodies: toSerializableSaveData(otherBodyArrayTypeId, otherBodies) as SerializableOtherBody[],
      bodySupporterJoints: toSerializableSaveData(bodySupporterJointArrayTypeId, bodySupporterJoints) as SerializableBodySupporterJoint[],
      otherJoints: toSerializableSaveData(jointArrayTypeId, otherJoints) as SerializableJoint[],
      speed,
      motors,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex: currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
    } as SerializableTrain;
  } else if (type === bogieArrayTypeId) {
    const bogies: Bogie[] = value;

    return bogies.map(bogie => toSerializableSaveData(bogieTypeId, bogie) as SerializableBogie);
  } else if (type === bogieTypeId) {
    const {
      position,
      rotation,
      pointOnTrack,
      weight,
      axles,
    }: Bogie = value;

    return {
      position: toSerializableSaveData(threeVector3TypeId, position) as THREE.Vector3Tuple,
      rotation: toSerializableSaveData(threeEulerTypeId, rotation) as SerializableEuler,
      pointOnTrack,
      weight,
      axles: toSerializableSaveData(axleArrayTypeId, axles) as SerializableAxle[],
    } as SerializableBogie;
  } else if (type === axleArrayTypeId) {
    const axles: Axle[] = value;

    return axles.map(axle => toSerializableSaveData(axleTypeId, axle) as SerializableAxle);
  } else if (type === axleTypeId) {
    const {
      pointOnTrack,
      z,
      position,
      rotation,
      diameter,
      hasMotor,
      rotationIsReversed,
    }: Axle = value;

    return {
      pointOnTrack,
      z,
      position: toSerializableSaveData(threeVector3TypeId, position) as THREE.Vector3Tuple,
      rotation: toSerializableSaveData(threeEulerTypeId, rotation) as SerializableEuler,
      diameter,
      hasMotor,
      rotationIsReversed,
    } as SerializableAxle;
  } else if (type === otherBodyArrayTypeId) {
    const otherBodies: OtherBody[] = value;

    return otherBodies.map(otherBody => toSerializableSaveData(otherBodyTypeId, otherBody) as SerializableOtherBody);
  } else if (type === otherBodyTypeId) {
    const {
      position,
      rotation,
      pointOnTrack,
      weight,
      controlStand,
    }: OtherBody = value;

    return {
      position: toSerializableSaveData(threeVector3TypeId, position) as THREE.Vector3Tuple,
      rotation: toSerializableSaveData(threeEulerTypeId, rotation) as SerializableEuler,
      pointOnTrack,
      weight,
      controlStand,
    } as SerializableOtherBody;
  } else if (type === bodySupporterJointArrayTypeId) {
    const bodySupporterJoints: BodySupporterJoint[] = value;

    return bodySupporterJoints.map(bodySupporterJoint => toSerializableSaveData(bodySupporterJointTypeId, bodySupporterJoint) as SerializableBodySupporterJoint);
  } else if (type === bodySupporterJointTypeId) {
    const {
      otherBodyIndex,
      otherBodyPosition,
      bogieIndex,
      bogiePosition,
    }: BodySupporterJoint = value;

    return {
      otherBodyIndex,
      otherBodyPosition: toSerializableSaveData(threeVector3TypeId, otherBodyPosition) as THREE.Vector3Tuple,
      bogieIndex,
      bogiePosition: toSerializableSaveData(threeVector3TypeId, bogiePosition) as THREE.Vector3Tuple,
    } as SerializableBodySupporterJoint;
  } else if (type === jointArrayTypeId) {
    const joints: Joint[] = value;

    return joints.map(joint => toSerializableSaveData(jointTypeId, joint) as SerializableJoint);
  } else if (type === jointTypeId) {
    const {
      bodyIndexA,
      positionA,
      bodyIndexB,
      positionB,
    }: Joint = value;

    return {
      bodyIndexA,
      positionA: toSerializableSaveData(threeVector3TypeId, positionA) as THREE.Vector3Tuple,
      bodyIndexB,
      positionB: toSerializableSaveData(threeVector3TypeId, positionB) as THREE.Vector3Tuple,
    } as SerializableJoint;
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
  } else if (type === trainsObjectTypeId) {
    const serializableTrains: { [key: string]: SerializableTrain } = value;
    const trains: { [key: string]: Train } = {};

    Object.keys(serializableTrains).forEach(id =>
      trains[id] = fromSerializableSaveData(trainTypeId, serializableTrains[id], data) as Train
    );

    return trains;
  } else if (type === trainTypeId) {
    const {
      bogies,
      otherBodies,
      bodySupporterJoints,
      otherJoints,
      speed,
      motors,
      currentDiagramId,
      currentDiagramCurveIndex,
      currentDiagramSectionIndex,
      currentRouteIndex,
      isStopping,
    }: SerializableTrain = value;

    const train = createTrain(
      data,
      fromSerializableSaveData(bogieArrayTypeId, bogies, data) as Bogie[],
      fromSerializableSaveData(otherBodyArrayTypeId, otherBodies, data) as OtherBody[],
      fromSerializableSaveData(bodySupporterJointArrayTypeId, bodySupporterJoints, data) as BodySupporterJoint[],
      fromSerializableSaveData(jointArrayTypeId, otherJoints, data) as Joint[],
      speed,
      motors,
    );

    train.currentDiagramId = currentDiagramId;
    train.currentDiagramCurveIndex = currentDiagramCurveIndex;
    train.currentDiagramSectionIndex = currentDiagramSectionIndex;
    train.currentRouteIndex = currentRouteIndex;
    train.isStopping = isStopping;

    return train;
  } else if (type === bogieArrayTypeId) {
    const serializableBogies: SerializableBogie[] = value;

    const bogies: Bogie[] = serializableBogies.map(bogie =>
      fromSerializableSaveData(bogieTypeId, bogie, data)
    );

    return bogies;
  } else if (type === bogieTypeId) {
    const {
      position,
      rotation,
      pointOnTrack,
      weight,
      axles,
    }: SerializableBogie = value;

    const bogie: Bogie = {
      position: fromSerializableSaveData(threeVector3TypeId, position, data),
      rotation: fromSerializableSaveData(threeEulerTypeId, rotation, data),
      pointOnTrack,
      weight,
      axles: fromSerializableSaveData(axleArrayTypeId, axles, data),
    };

    return bogie;
  } else if (type === axleArrayTypeId) {
    const serializableAxles: SerializableAxle[] = value;

    const axles: Axle[] = serializableAxles.map(axle =>
      fromSerializableSaveData(axleTypeId, axle, data)
    );

    return axles;
  } else if (type === axleTypeId) {
    const {
      pointOnTrack,
      z,
      position,
      rotation,
      diameter,
      hasMotor,
      rotationIsReversed,
    }: SerializableAxle = value;

    const axle: Axle = {
      pointOnTrack,
      z,
      position: fromSerializableSaveData(threeVector3TypeId, position, data),
      rotation: fromSerializableSaveData(threeEulerTypeId, rotation, data),
      diameter,
      rotationX: 0,
      hasMotor,
      rotationIsReversed,
    };

    return axle;
  } else if (type === otherBodyArrayTypeId) {
    const serializableOtherBodies: SerializableOtherBody[] = value;

    const otherBodies: OtherBody[] = serializableOtherBodies.map(otherBody =>
      fromSerializableSaveData(otherBodyTypeId, otherBody, data)
    );

    return otherBodies;
  } else if (type === otherBodyTypeId) {
    const {
      position,
      rotation,
      pointOnTrack,
      weight,
      controlStand,
    }: SerializableOtherBody = value;

    const otherBody: OtherBody = {
      position: fromSerializableSaveData(threeVector3TypeId, position, data),
      rotation: fromSerializableSaveData(threeEulerTypeId, rotation, data),
      pointOnTrack,
      weight,
      controlStand,
    };

    return otherBody;
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
