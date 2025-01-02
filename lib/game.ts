import * as THREE from 'three'
import EventEmitter from "events"
import { proxy } from "valtio"
import { WebSocket as WebSocketInNode } from "ws"
import { Axle, BodySupporterJoint, Bogie, CarBody, Joint, SerializableAxle, SerializableBogie, SerializableCarBody, SerializableTrain, Train, UIOneHandleMasterControllerConfig, createTrain, updateTrainOnTime } from "./trains";
//import { ProjectedLine, SerializableProjectedLine } from "./gis";
import { FeatureCollection } from "geojson";
import { SerializableSwitch, SerializableTrack, SerializableTransitionCurve, Switch, Track, TransitionCurve } from './tracks';
import { HeightmapType } from './terrain';

export type IdentifiedRecord = { id: string };

// 参照されるデータの後に参照するデータの順で並べる必要がある
export type GameStateType = { [key: string]: any } & {
  terrains: { [key: string]: { [key: string]: HeightmapType } };
  featureCollections: { [key: string]: { value: FeatureCollection } };
  //projectedLines: { [key: string]: ProjectedLine };
  tracks: { [key: string]: Track | TransitionCurve };
  switches: { [key: string]: Switch };
  trains: { [key: string]: Train };
  /** Trainを文字列で分類する */
  trainGroups: { [key: string]: string[] };
  uiOneHandleMasterControllerConfigs: { [key: string]: UIOneHandleMasterControllerConfig };
  nowDate: number;
  visibleFeatureCollections: string[];
}

export function getNewState() {
  const state = proxy<GameStateType>({
    terrains: {},
    featureCollections: {},
    //projectedLines: {},
    tracks: {},
    switches: {},
    trains: {},
    trainGroups: {},
    uiOneHandleMasterControllerConfigs: {},
    nowDate: Date.now(),
    visibleFeatureCollections: [],
  })

  return state
}

export function toSerializableProp(path: string[], value: any): any {
  if (path[0] === "tracks") {
    if (path.length === 1)
      return Object.keys(value).map(id => toSerializableProp([path[0], id], value[id]))
    else if (path.length === 2) {
      const {
        centerCoordinate,
        position,
        rotationY,
        length,
        radius,
        idOfTrackOrSwitchConnectedFromStart,
        idOfTrackOrSwitchConnectedFromEnd,
        connectedFromStartIsTrack,
        connectedFromEndIsTrack,
        connectedFromStartIsToEnd,
        connectedFromEndIsToEnd,
        beginRotationX,
        endRotationX,
        modelPaths,
        gradients,
      } = value as Track

      const serializableTrack: SerializableTrack = {
        id: path[1],
        centerCoordinate,
        position: position.toArray(),
        rotationY,
        length,
        radius,
        idOfTrackOrSwitchConnectedFromStart,
        idOfTrackOrSwitchConnectedFromEnd,
        connectedFromStartIsTrack,
        connectedFromEndIsTrack,
        connectedFromStartIsToEnd,
        connectedFromEndIsToEnd,
        beginRotationX,
        endRotationX,
        modelPaths,
        gradients,
      }

      if ((value as TransitionCurve).endPosition === undefined)
        return serializableTrack
      else {
        const { beginCurvature, endCurvature, endPosition, endRotationY, transitionCurves, curveDirection } = value as TransitionCurve

        return {
          ...serializableTrack,
          beginCurvature,
          endCurvature,
          endPosition: endPosition.toArray(),
          endRotationY,
          transitionCurves: transitionCurves.map(value => ({
            position: value.position.toArray(),
            rotationY: value.rotationY,
            curvature: value.curvature,
          })),
          curveDirection,
        } as SerializableTransitionCurve
      }
    }
  } else if (path[0] === "switches") {
    if (path.length === 1)
      return Object.keys(value).map(id => toSerializableProp([path[0], id], value[id]))
    else if (path.length === 2) {
      const { connectedTrackIds, isConnectedToEnd, currentConnected } = value as Switch

      return {
        id: path[1],
        connectedTrackIds,
        isConnectedToEnd,
        currentConnected,
      } as SerializableSwitch
    }
  }/* else if (path[0] === "projectedLines") {
    if (path.length === 1) {
      const prop = value as GameStateType["projectedLines"]

      return Object.keys(prop).map(projectedLineId => {
        const { centerCoordinate, points } = prop[projectedLineId]

        return {
          id: projectedLineId,
          centerCoordinate,
          points: points.map(point => point.toArray()),
        }
      }) as SerializableProjectedLine[]
    }
  }*/ else if (path[0] === "trains") {
    if (path.length === 1)
      return Object.keys(value).map(id => toSerializableProp([path[0], id], value[id]))
    else if (path.length === 2) {
      const { bogies, otherBodies, bodySupporterJoints, otherJoints, speed, motors } = value as Train

      return {
        id: path[1],
        bogies: bogies.map(({ position, rotation, pointOnTrack, weight, controlStands, axles }) => ({
          position: position.toArray(),
          rotation: [rotation.x, rotation.y, rotation.z, rotation.order],
          pointOnTrack,
          weight,
          controlStands,
          axles: axles.map(({ pointOnTrack, z, position, rotation, diameter, hasMotor, rotationIsReversed }) => ({
            pointOnTrack,
            z,
            position: position.toArray(),
            rotation: [rotation.x, rotation.y, rotation.z, rotation.order],
            diameter,
            hasMotor,
            rotationIsReversed,
          } as SerializableAxle)),
        } as SerializableBogie)),
        otherBodies: otherBodies.map(({ position, rotation, pointOnTrack, weight, controlStands }) => ({
          position: position.toArray(),
          rotation: [rotation.x, rotation.y, rotation.z, rotation.order],
          pointOnTrack,
          weight,
          controlStands,
        } as SerializableCarBody)),
        bodySupporterJoints: bodySupporterJoints.map(({ otherBodyIndex, otherBodyPosition, bogieIndex, bogiePosition }) => ({
          otherBodyIndex,
          otherBodyPosition: otherBodyPosition.toArray(),
          bogieIndex,
          bogiePosition: bogiePosition.toArray(),
        })),
        otherJoints: otherJoints.map(({ bodyIndexA, positionA, bodyIndexB, positionB }) => ({
          bodyIndexA,
          positionA: positionA.toArray(),
          bodyIndexB,
          positionB: positionB.toArray(),
        })),
        speed,
        motors,
      } as SerializableTrain
    }
  }

  return value
}

export function fromSerializableProp(path: string[], value: any, gameState: GameStateType) {
  if (path[0] === "tracks") {
    if (path.length === 1) {
      const json = value as SerializableTrack[]

      const prop: GameStateType["tracks"] = {}
      json.forEach(value_ =>
        prop[value_.id] = fromSerializableProp([path[0], value_.id], value_, gameState) as Track
      )
      return prop
    } else if (path.length === 2) {
      const {
        centerCoordinate,
        position,
        rotationY,
        length,
        radius,
        idOfTrackOrSwitchConnectedFromStart,
        idOfTrackOrSwitchConnectedFromEnd,
        connectedFromStartIsTrack,
        connectedFromEndIsTrack,
        connectedFromStartIsToEnd,
        connectedFromEndIsToEnd,
        beginRotationX,
        endRotationX,
        modelPaths,
        gradients,
      } = value as SerializableTrack

      const track: Track = {
        centerCoordinate,
        position: new THREE.Vector3(...position),
        rotationY,
        length,
        radius,
        idOfTrackOrSwitchConnectedFromStart,
        idOfTrackOrSwitchConnectedFromEnd,
        connectedFromStartIsTrack,
        connectedFromEndIsTrack,
        connectedFromStartIsToEnd,
        connectedFromEndIsToEnd,
        beginRotationX,
        endRotationX,
        modelPaths,
        gradients,
      }

      if ((value as SerializableTransitionCurve).endPosition === undefined)
        return track
      else {
        const { beginCurvature, endCurvature, endPosition, endRotationY, transitionCurves, curveDirection } = value as SerializableTransitionCurve

        return {
          ...track,
          beginCurvature,
          endCurvature,
          endPosition: new THREE.Vector3(...endPosition),
          endRotationY,
          transitionCurves: transitionCurves.map(value => ({
            position: new THREE.Vector3(...value.position),
            rotationY: value.rotationY,
            curvature: value.curvature,
          })),
          curveDirection,
        } as TransitionCurve
      }
    }
  } else if (path[0] === "switches") {
    if (path.length === 1) {
      const json = value as SerializableSwitch[]

      const prop: GameStateType["switches"] = {}
      json.forEach(value_ =>
        prop[value_.id] = fromSerializableProp([path[0], value_.id], value_, gameState) as Switch
      )
      return prop
    } else if (path.length === 2) {
      const { connectedTrackIds, isConnectedToEnd, currentConnected } = value as SerializableSwitch

      return {
        connectedTrackIds,
        isConnectedToEnd,
        currentConnected,
      } as Switch
    }
  }/* else if (path[0] === "projectedLines") {
    if (path.length === 1) {
      const json = value as SerializableProjectedLine[]

      const prop: GameStateType["projectedLines"] = {}
      json.forEach(({ id, centerCoordinate, points }) =>
        prop[id] = {
          centerCoordinate,
          points: points.map(point => new THREE.Vector3(...point)),
        }
      )
      return prop
    }
  }*/ else if (path[0] === "trains") {
    if (path.length === 1) {
      const json = value as SerializableTrain[]

      const prop: GameStateType["trains"] = {}
      json.forEach(value_ =>
        prop[value_.id] = fromSerializableProp([path[0], value_.id], value_, gameState) as Train
      )
      return prop
    } else if (path.length === 2) {
      const { bogies, otherBodies, bodySupporterJoints, otherJoints, speed, motors } = value as SerializableTrain

      return createTrain(
        gameState,
        bogies.map(({ position, rotation, pointOnTrack, weight, controlStands, axles }) => ({
          position: new THREE.Vector3(...position),
          rotation: new THREE.Euler(...rotation),
          pointOnTrack,
          weight,
          controlStands,
          axles: axles.map(({ pointOnTrack, z, position, rotation, diameter, hasMotor, rotationIsReversed }) => ({
            pointOnTrack,
            z,
            position: new THREE.Vector3(...position),
            rotation: new THREE.Euler(...rotation),
            diameter,
            rotationX: 0,
            hasMotor,
            rotationIsReversed,
          } as Axle)),
        } as Bogie)),
        otherBodies.map(({ position, rotation, pointOnTrack, weight, controlStands }) => ({
          position: new THREE.Vector3(...position),
          rotation: new THREE.Euler(...rotation),
          pointOnTrack,
          weight,
          controlStands,
        } as CarBody)),
        bodySupporterJoints.map(({ otherBodyIndex, otherBodyPosition, bogieIndex, bogiePosition }) => ({
          otherBodyIndex,
          otherBodyPosition: new THREE.Vector3(...otherBodyPosition),
          bogieIndex,
          bogiePosition: new THREE.Vector3(...bogiePosition),
        } as BodySupporterJoint)),
        otherJoints.map(({ bodyIndexA, positionA, bodyIndexB, positionB }) => ({
          bodyIndexA,
          positionA: new THREE.Vector3(...positionA),
          bodyIndexB,
          positionB: new THREE.Vector3(...positionB),
        } as Joint)),
        speed,
        undefined,
        motors,
      )
    }
  }

  return value
}

let timeRemainder = 0;

export function updateTime(gameState: GameStateType, delta: number) {
  // Time
  timeRemainder += delta * 1000
  const deltaMilliseconds = Math.floor(timeRemainder)
  timeRemainder -= deltaMilliseconds
  gameState.nowDate += deltaMilliseconds

  // Trains
  Object.keys(gameState.trains).forEach(trainId => {
    const train = gameState.trains[trainId]

    updateTrainOnTime(gameState, train, delta)
  })
}

export type OnMessageInClient = (id: number, value: any, ws: WebSocket | WebSocket) => void;
export type OnMessageInServer = (id: number, value: any, ws: WebSocket | WebSocketInNode) => void;

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

export const FROM_SERVER_STATE = 0
export const FROM_SERVER_STATE_OPS = 1
export const FROM_SERVER_CANCEL = 2
export const FROM_CLIENT_SET_OBJECT = 3
export const FROM_CLIENT_DELETE_OBJECT = 4
export const FROM_CLIENT_SAVE = 5
export const FROM_CLIENT_SWITCH_TRACK = 6
export const FROM_CLIENT_GET_HEIGHTMAP = 7
export const FROM_CLIENT_MASTER_CONTOLLER_CHANGE_STATE = 8
export const FROM_CLIENT_SET_PROP = 9
export const FROM_CLIENT_DELETE_PROP = 10
export const FROM_CLIENT_SET_TRAIN = 11
