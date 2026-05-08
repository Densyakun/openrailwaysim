// クライアントとサーバーに共通するデータの管理と操作
import * as THREE from 'three'
import EventEmitter from "events"
import { WebSocket as WebSocketInNode } from "ws"
import { Axle, Bogie, BodySupporterJoint, CarBody, Joint, SerializableBodySupporterJoint, SerializableJoint, SerializableTrainFormat, Train, TrainFormat, UIOneHandleMasterControllerConfig, getPointOnTrackByTrain, placeTrain, updateTrainOnTime } from "./trains";
import { FeatureCollection, Position } from "geojson";
import { SerializableTrack, SerializableTransitionCurve, SerializableTransitionCurveSegment, Switch, Track, TransitionCurve, TransitionCurveSegment } from './tracks';
import { HeightmapType } from './terrain';
import { Diagram } from './diagram';
import { MessageCode, MessageValueMap } from './ws';
import { proxy } from 'valtio';

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

export const store = proxy<{
  data: ORSAppDataType;
}>({
  data: createAppData(),
});

export type ORSAppDataType = {
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

export type SerializableORSAppDataType = {
  originCoordinate: Position;
  terrains: { [key: string]: { [key: string]: HeightmapType } };
  featureCollections: { [key: string]: { value: FeatureCollection } };
  tracks: { [key: string]: SerializableTrack | SerializableTransitionCurve };
  switches: { [key: string]: Switch };
  trainFormats: { [key: string]: SerializableTrainFormat };
  trains: { [key: string]: Train };
  trainGroups: { [key: string]: string[] };
  uiOneHandleMasterControllerConfigs: { [key: string]: UIOneHandleMasterControllerConfig };
  nowDate: number;
  diagrams: { [key: string]: Diagram };
};

export function createAppData(): ORSAppDataType {
  return {
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
}

export type SerializableEuler = [number, number, number, THREE.EulerOrder];

export const orsAppDataTypeId = "orsAppData";
export const tracksObjectTypeId = "tracksObject";
export const trackTypeId = "track";
export const transitionCurveSegmentArrayTypeId = "transitionCurveSegmentArray";
export const transitionCurveSegmentTypeId = "transitionCurveSegment";
export const trainFormatsObjectTypeId = "trainFormatsObject";
export const trainFormatTypeId = "trainFormat";
export const bodySupporterJointArrayTypeId = "bodySupporterJointArray";
export const bodySupporterJointTypeId = "bodySupporterJoint";
export const jointArrayTypeId = "jointArray";
export const jointTypeId = "joint";
export const trainsObjectTypeId = "trainsObject";
export const trainTypeId = "train";
export const bogieArrayTypeId = "bogieArray";
export const bogieTypeId = "bogie";
export const axleArrayTypeId = "axleArray";
export const axleTypeId = "axle";
export const carBodyArrayTypeId = "carBodyArray";
export const carBodyTypeId = "carBody";
export const threeVector3TypeId = "THREE.Vector3";
export const threeEulerTypeId = "THREE.Euler";

export function getTypeIdByPath(path: Path<SerializableORSAppDataType>) {
  if (!path.length) return orsAppDataTypeId;
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
    if (path.length >= 3) {
      if (path[2] === "bogies") {
        if (path.length === 3) return bogieArrayTypeId;
        if (path.length === 4) return bogieTypeId;
        if (path.length >= 5) {
          if (path[4] === "axles") {
            if (path.length === 5) return axleArrayTypeId;
            if (path.length === 6) return axleTypeId;
            if (path.length >= 7) {
              if (path[6] === "position") return threeVector3TypeId;
              if (path[6] === "rotation") return threeEulerTypeId;
            }
          } else {
            if (path[4] === "position") return threeVector3TypeId;
            if (path[4] === "rotation") return threeEulerTypeId;
          }
        }
      } else if (path[2] === "otherBodies") {
        if (path.length === 3) return carBodyArrayTypeId;
        if (path.length === 4) return carBodyTypeId;
        if (path.length >= 5) {
          if (path[4] === "position") return threeVector3TypeId;
          if (path[4] === "rotation") return threeEulerTypeId;
        }
      }
    }
  }
  return "";
}

export function serialize(type: string, value: any): any {
  if (type === orsAppDataTypeId) {
    const orsAppData: ORSAppDataType = value;

    const serializableORSAppData: SerializableORSAppDataType = {
      ...orsAppData,
      tracks: serialize(tracksObjectTypeId, orsAppData.tracks) as { [key: string]: SerializableTrack | SerializableTransitionCurve },
      trainFormats: serialize(trainFormatsObjectTypeId, orsAppData.trainFormats) as { [key: string]: SerializableTrainFormat },
    };

    return serializableORSAppData;
  } else if (type === tracksObjectTypeId) {
    const tracks: { [key: string]: Track | TransitionCurve } = value;
    const serializableTracks: { [key: string]: SerializableTrack | SerializableTransitionCurve } = {};

    Object.keys(tracks).forEach(id => serializableTracks[id] = serialize(trackTypeId, tracks[id]) as SerializableTrack | SerializableTransitionCurve);

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
      position: serialize(threeVector3TypeId, position) as THREE.Vector3Tuple,
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
        endPosition: serialize(threeVector3TypeId, endPosition) as THREE.Vector3Tuple,
        endRotationY,
        transitionCurves: serialize(transitionCurveSegmentArrayTypeId, transitionCurves) as SerializableTransitionCurveSegment[],
        curveDirection,
      };

      return serializableTransitionCurve;
    }
  } else if (type === transitionCurveSegmentArrayTypeId) {
    const transitionCurves: TransitionCurveSegment[] = value;

    return transitionCurves.map(transitionCurve => serialize(transitionCurveSegmentTypeId, transitionCurve) as SerializableTransitionCurveSegment);
  } else if (type === transitionCurveSegmentTypeId) {
    const { position, rotationY, curvature }: TransitionCurveSegment = value;

    const serializableTransitionCurveSegment: SerializableTransitionCurveSegment = {
      position: serialize(threeVector3TypeId, position) as THREE.Vector3Tuple,
      rotationY: rotationY,
      curvature: curvature,
    };

    return serializableTransitionCurveSegment;
  } else if (type === trainFormatsObjectTypeId) {
    const trainFormats: { [key: string]: TrainFormat } = value;
    const serializableTrainFormats: { [key: string]: SerializableTrainFormat } = {};

    Object.keys(trainFormats).forEach(id => serializableTrainFormats[id] = serialize(trainFormatTypeId, trainFormats[id]) as SerializableTrainFormat);

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
      bodySupporterJoints: serialize(bodySupporterJointArrayTypeId, bodySupporterJoints) as SerializableBodySupporterJoint[],
      otherJoints: serialize(jointArrayTypeId, otherJoints) as SerializableJoint[],
    };

    return serializableTrainFormat;
  } else if (type === bodySupporterJointArrayTypeId) {
    const bodySupporterJoints: BodySupporterJoint[] = value;

    return bodySupporterJoints.map(bodySupporterJoint => serialize(bodySupporterJointTypeId, bodySupporterJoint) as SerializableBodySupporterJoint);
  } else if (type === bodySupporterJointTypeId) {
    const {
      otherBodyIndex,
      otherBodyPosition,
      bogieIndex,
      bogiePosition,
    }: BodySupporterJoint = value;

    const serializableBodySupporterJoint: SerializableBodySupporterJoint = {
      otherBodyIndex,
      otherBodyPosition: serialize(threeVector3TypeId, otherBodyPosition) as THREE.Vector3Tuple,
      bogieIndex,
      bogiePosition: serialize(threeVector3TypeId, bogiePosition) as THREE.Vector3Tuple,
    };

    return serializableBodySupporterJoint;
  } else if (type === jointArrayTypeId) {
    const joints: Joint[] = value;

    return joints.map(joint => serialize(jointTypeId, joint) as SerializableJoint);
  } else if (type === jointTypeId) {
    const {
      bodyIndexA,
      positionA,
      bodyIndexB,
      positionB,
    }: Joint = value;

    const serializableJoint: SerializableJoint = {
      bodyIndexA,
      positionA: serialize(threeVector3TypeId, positionA) as THREE.Vector3Tuple,
      bodyIndexB,
      positionB: serialize(threeVector3TypeId, positionB) as THREE.Vector3Tuple,
    };

    return serializableJoint;
  } else if (type === trainsObjectTypeId) {
    const trains: { [key: string]: Train } = value;
    const serializableTrains: { [key: string]: any } = {};

    Object.keys(trains).forEach(id =>
      serializableTrains[id] = serialize(trainTypeId, trains[id])
    );

    return serializableTrains;
  } else if (type === trainTypeId) {
    const {
      bogies,
      otherBodies,
      ...rest
    } = value;

    const serializableTrain = {
      ...rest,
      bogies: serialize(bogieArrayTypeId, bogies),
      otherBodies: serialize(carBodyArrayTypeId, otherBodies),
    };

    return serializableTrain;
  } else if (type === bogieArrayTypeId) {
    const bogies: Bogie[] = value;
    return bogies.map(bogie => serialize(bogieTypeId, bogie));
  } else if (type === bogieTypeId) {
    const {
      axles,
      position,
      rotation,
      ...rest
    } = value;

    const serializableBogie = {
      ...rest,
      axles: serialize(axleArrayTypeId, axles),
      position: serialize(threeVector3TypeId, position),
      rotation: serialize(threeEulerTypeId, rotation),
    };

    return serializableBogie;
  } else if (type === axleArrayTypeId) {
    const axles: Axle[] = value;
    return axles.map(axle => serialize(axleTypeId, axle));
  } else if (type === axleTypeId) {
    const {
      position,
      rotation,
      pointOnTrack,
      ...rest
    } = value;

    const serializableAxle = {
      ...rest,
      position: serialize(threeVector3TypeId, position),
      rotation: serialize(threeEulerTypeId, rotation),
      pointOnTrack,
    };

    return serializableAxle;
  } else if (type === carBodyArrayTypeId) {
    const carBodies: CarBody[] = value;
    return carBodies.map(carBody => serialize(carBodyTypeId, carBody));
  } else if (type === carBodyTypeId) {
    const {
      position,
      rotation,
      ...rest
    } = value;

    const serializableCarBody = {
      ...rest,
      position: serialize(threeVector3TypeId, position),
      rotation: serialize(threeEulerTypeId, rotation),
    };

    return serializableCarBody;
  } else if (type === threeVector3TypeId) {
    const position: THREE.Vector3 = value;

    return position.toArray ? position.toArray() : [position.x, position.y, position.z];
  } else if (type === threeEulerTypeId) {
    const rotation: THREE.Euler = value;

    return [rotation.x, rotation.y, rotation.z, rotation.order];
  }

  return value;
}

export function deserialize(type: string, value: any): any {
  if (type === orsAppDataTypeId) {
    const serializableORSAppData: SerializableORSAppDataType = value;

    const orsAppData: ORSAppDataType = {
      ...createAppData(),
      ...value,
      tracks: deserialize(tracksObjectTypeId, serializableORSAppData.tracks) as { [key: string]: Track },
      trainFormats: deserialize(trainFormatsObjectTypeId, serializableORSAppData.trainFormats) as { [key: string]: TrainFormat },
      trains: deserialize(trainsObjectTypeId, serializableORSAppData.trains) as { [key: string]: Train },
    };

    return orsAppData;
  } else if (type === tracksObjectTypeId) {
    const serializableTracks: { [key: string]: SerializableTrack } = value;
    const tracks: { [key: string]: Track } = {};

    Object.keys(serializableTracks).forEach(id =>
      tracks[id] = deserialize(trackTypeId, serializableTracks[id]) as Track
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
      position: deserialize(threeVector3TypeId, position) as THREE.Vector3,
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
        endPosition: deserialize(threeVector3TypeId, endPosition) as THREE.Vector3,
        endRotationY,
        transitionCurves: deserialize(transitionCurveSegmentArrayTypeId, transitionCurves) as TransitionCurveSegment[],
        curveDirection,
      };

      return transitionCurve;
    }
  } else if (type === transitionCurveSegmentArrayTypeId) {
    const serializableTransitionCurves: SerializableTransitionCurveSegment[] = value;

    const transitionCurves: TransitionCurveSegment[] = serializableTransitionCurves.map(transitionCurve =>
      deserialize(transitionCurveSegmentTypeId, transitionCurve)
    );

    return transitionCurves;
  } else if (type === transitionCurveSegmentTypeId) {
    const {
      position,
      rotationY,
      curvature,
    }: SerializableTransitionCurveSegment = value;

    const transitionCurveSegment: TransitionCurveSegment = {
      position: deserialize(threeVector3TypeId, position) as THREE.Vector3,
      rotationY,
      curvature,
    };

    return transitionCurveSegment;
  } else if (type === trainFormatsObjectTypeId) {
    const serializableTrainFormats: { [key: string]: SerializableTrainFormat } = value;
    const trainFormats: { [key: string]: TrainFormat } = {};

    Object.keys(serializableTrainFormats).forEach(id =>
      trainFormats[id] = deserialize(trainFormatTypeId, serializableTrainFormats[id]) as TrainFormat
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
      bodySupporterJoints: deserialize(bodySupporterJointArrayTypeId, bodySupporterJoints) as BodySupporterJoint[],
      otherJoints: deserialize(jointArrayTypeId, otherJoints) as Joint[],
    };

    return trainFormat;
  } else if (type === bodySupporterJointArrayTypeId) {
    const serializableBodySupporterJoints: SerializableBodySupporterJoint[] = value;

    const bodySupporterJoints: BodySupporterJoint[] = serializableBodySupporterJoints.map(bodySupporterJoint =>
      deserialize(bodySupporterJointTypeId, bodySupporterJoint)
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
      otherBodyPosition: deserialize(threeVector3TypeId, otherBodyPosition),
      bogieIndex,
      bogiePosition: deserialize(threeVector3TypeId, bogiePosition),
    };

    return bodySupporterJoint;
  } else if (type === jointArrayTypeId) {
    const serializableJoints: SerializableJoint[] = value;

    const joints: Joint[] = serializableJoints.map(joint =>
      deserialize(jointTypeId, joint)
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
      positionA: deserialize(threeVector3TypeId, positionA),
      bodyIndexB,
      positionB: deserialize(threeVector3TypeId, positionB),
    };

    return joint;
  } else if (type === trainsObjectTypeId) {
    const serializableTrains: { [key: string]: any } = value;
    const trains: { [key: string]: Train } = {};

    Object.keys(serializableTrains).forEach(id =>
      trains[id] = deserialize(trainTypeId, serializableTrains[id]) as Train
    );

    return trains;
  } else if (type === trainTypeId) {
    const {
      bogies,
      otherBodies,
      ...rest
    } = value;

    const train: Train = {
      ...rest,
      bogies: deserialize(bogieArrayTypeId, bogies),
      otherBodies: deserialize(carBodyArrayTypeId, otherBodies),
    };

    return train;
  } else if (type === bogieArrayTypeId) {
    const serializableBogies: any[] = value;
    return serializableBogies.map(bogie => deserialize(bogieTypeId, bogie));
  } else if (type === bogieTypeId) {
    const {
      axles,
      position,
      rotation,
      ...rest
    } = value;

    const bogie: Bogie = {
      ...rest,
      axles: deserialize(axleArrayTypeId, axles),
      position: deserialize(threeVector3TypeId, position),
      rotation: deserialize(threeEulerTypeId, rotation),
    };

    return bogie;
  } else if (type === axleArrayTypeId) {
    const serializableAxles: any[] = value;
    return serializableAxles.map(axle => deserialize(axleTypeId, axle));
  } else if (type === axleTypeId) {
    const {
      position,
      rotation,
      pointOnTrack,
      ...rest
    } = value;

    const axle: Axle = {
      ...rest,
      position: deserialize(threeVector3TypeId, position),
      rotation: deserialize(threeEulerTypeId, rotation),
      pointOnTrack: {
        ...pointOnTrack,
      },
    };

    return axle;
  } else if (type === carBodyArrayTypeId) {
    const serializableCarBodies: any[] = value;
    return serializableCarBodies.map(carBody => deserialize(carBodyTypeId, carBody));
  } else if (type === carBodyTypeId) {
    const {
      position,
      rotation,
      ...rest
    } = value;

    const carBody: CarBody = {
      ...rest,
      position: deserialize(threeVector3TypeId, position),
      rotation: deserialize(threeEulerTypeId, rotation),
    };

    return carBody;
  } else if (type === threeVector3TypeId) {
    if (value instanceof THREE.Vector3) return value;
    if (Array.isArray(value)) {
      return new THREE.Vector3(...value);
    }
    if (value && typeof value === "object") {
      return new THREE.Vector3(value.x ?? 0, value.y ?? 0, value.z ?? 0);
    }
    return new THREE.Vector3();
  } else if (type === threeEulerTypeId) {
    if (value instanceof THREE.Euler) return value;
    if (Array.isArray(value)) {
      return new THREE.Euler(value[0], value[1], value[2], value[3]);
    }
    if (value && typeof value === "object") {
      return new THREE.Euler(value.x ?? 0, value.y ?? 0, value.z ?? 0, value.order ?? value._order ?? 'YXZ');
    }
    return new THREE.Euler();
  }

  return value;
}

let timeRemainder = 0;

export function updateTime(delta: number) {
  const orsAppData = store.data;

  // Time
  timeRemainder += delta * 1000
  const deltaMilliseconds = Math.floor(timeRemainder)
  timeRemainder -= deltaMilliseconds
  orsAppData.nowDate += deltaMilliseconds

  // Trains
  Object.keys(orsAppData.trains).forEach(trainId => {
    const train = orsAppData.trains[trainId]

    if (trainId === "preview" && !(train as any).isSyncPreview) return;

    updateTrainOnTime(train, delta)
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
