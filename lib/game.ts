import * as THREE from 'three'
import EventEmitter from "events"
import { proxy } from "valtio"
import { WebSocket as WebSocketInNode } from "ws"
import { Axle, BodySupporterJoint, Bogie, CarBody, Joint, SerializableAxle, SerializableBogie, SerializableCarBody, SerializableTrain, Train, UIOneHandleMasterControllerConfig, createTrain, updateTime as updateTrainOnTime } from "./trains";
import { ProjectedLine, SerializableProjectedLine } from "./gis";
import { FeatureCollection } from "@turf/helpers";
import { SerializableTrack, Track } from './tracks';

export type IdentifiedRecord = { id: string };

// 参照されるデータの後に参照するデータの順で並べる必要がある
export type GameStateType = { [key: string]: any } & {
  featureCollections: { [key: string]: { value: FeatureCollection } };
  projectedLines: { [key: string]: ProjectedLine };
  tracks: { [key: string]: Track };
  trains: { [key: string]: Train };
  uiOneHandleMasterControllerConfigs: { [key: string]: UIOneHandleMasterControllerConfig };
  nowDate: number;
}

export function getNewState() {
  const state = proxy<GameStateType>({
    featureCollections: {},
    projectedLines: {},
    tracks: {},
    trains: {},
    uiOneHandleMasterControllerConfigs: {},
    nowDate: Date.now(),
  })

  return state
}

export function toSerializableProp(path: string[], value: any) {
  if (path[0] === "tracks") {
    if (path.length === 1) {
      const prop = value as GameStateType["tracks"]

      return Object.keys(prop).map(id => {
        const { centerCoordinate, position, rotationY, length, radius } = prop[id]

        return {
          id,
          centerCoordinate,
          position: position.toArray(),
          rotationY,
          length,
          radius,
        }
      }) as SerializableTrack[]
    } else if (path.length === 2) {
      const { centerCoordinate, position, rotationY, length, radius } = value as Track

      return {
        id: path[1],
        centerCoordinate,
        position: position.toArray(),
        rotationY,
        length,
        radius,
      } as SerializableTrack
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
    if (path.length === 1) {
      const prop = value as GameStateType["trains"]

      return Object.keys(prop).map(trainId => {
        const { bogies, otherBodies, bodySupporterJoints, otherJoints, speed, motorCars } = prop[trainId]

        return {
          id: trainId,
          bogies: bogies.map(({ position, rotation, pointOnTrack, weight, masterControllers, axles }) => ({
            position: position.toArray(),
            rotation: [rotation.x, rotation.y, rotation.z, rotation.order],
            pointOnTrack,
            weight,
            masterControllers,
            axles: axles.map(({ pointOnTrack, z, position, rotation, diameter, hasMotor }) => ({
              pointOnTrack,
              z,
              position: position.toArray(),
              rotation: [rotation.x, rotation.y, rotation.z, rotation.order],
              diameter,
              hasMotor,
            } as SerializableAxle)),
          } as SerializableBogie)),
          otherBodies: otherBodies.map(({ position, rotation, pointOnTrack, weight, masterControllers }) => ({
            position: position.toArray(),
            rotation: [rotation.x, rotation.y, rotation.z, rotation.order],
            pointOnTrack,
            weight,
            masterControllers,
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
          motorCars,
        }
      }) as SerializableTrain[]
    }
  }

  return value
}

export function fromSerializableProp(path: string[], value: any, gameState: GameStateType) {
  if (path[0] === "tracks") {
    if (path.length === 1) {
      const json = value as SerializableTrack[]

      const prop: GameStateType["tracks"] = {}
      json.forEach(({ id, centerCoordinate, position, rotationY, length, radius }) =>
        prop[id] = {
          centerCoordinate,
          position: new THREE.Vector3(...position),
          rotationY,
          length,
          radius,
        }
      )
      return prop
    } else if (path.length === 2) {
      const { centerCoordinate, position, rotationY, length, radius } = value as SerializableTrack

      return {
        centerCoordinate,
        position: new THREE.Vector3(...position),
        rotationY,
        length,
        radius,
      } as Track
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
      json.forEach(({ id, bogies, otherBodies, bodySupporterJoints, otherJoints, speed, motorCars }) =>
        prop[id] = createTrain(
          gameState,
          bogies.map(({ position, rotation, pointOnTrack, weight, masterControllers, axles }) => ({
            position: new THREE.Vector3(...position),
            rotation: new THREE.Euler(...rotation),
            pointOnTrack,
            weight,
            masterControllers,
            axles: axles.map(({ pointOnTrack, z, position, rotation, diameter, hasMotor }) => ({
              pointOnTrack,
              z,
              position: new THREE.Vector3(...position),
              rotation: new THREE.Euler(...rotation),
              diameter,
              rotationX: 0,
              hasMotor,
            } as Axle)),
          } as Bogie)),
          otherBodies.map(({ position, rotation, pointOnTrack, weight, masterControllers }) => ({
            position: new THREE.Vector3(...position),
            rotation: new THREE.Euler(...rotation),
            pointOnTrack,
            weight,
            masterControllers,
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
          motorCars,
        )
      )
      return prop
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
        console.log(`Received invalid message. id: ${args[0]}, value: ${args[1]}`)

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
export const FROM_CLIENT_MASTER_CONTOLLER_CHANGE_STATE = 5
