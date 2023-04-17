import * as THREE from 'three'
import { FeatureCollection, LineString, Position } from '@turf/helpers'
import { default as turfBearing } from '@turf/bearing'
import { default as turfDestination } from '@turf/destination'
import { default as turfDistance } from '@turf/distance'
import { point as turfPoint } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import { proxy } from 'valtio'

export const sphericalEarthMeridianLength = turfDistance([0, -90], [0, 90], { units: 'meters' })

export type GlobalTransform = {
  quaternion: THREE.Quaternion;
  elevation: number;
}

export type GlobalPositionEuler = {
  euler: THREE.Euler;
  elevation: number;
}

export const state = proxy<{
  originTransform: GlobalTransform;
}>({
  originTransform: { quaternion: new THREE.Quaternion(), elevation: 0 },
})

export function move(pointQuaternion: THREE.Quaternion, moveX: number, moveZ: number, elevation = state.originTransform.elevation) {
  const distance = Math.sqrt(moveX ** 2 + moveZ ** 2)
    * (sphericalEarthMeridianLength / ((sphericalEarthMeridianLength / Math.PI + elevation) * Math.PI))
  const bearing = Math.atan2(-moveZ, moveX) * -180 / Math.PI + 90
  const destination = turfDestination(turfPoint([0, 0]), distance, bearing, { units: 'meters' })

  return pointQuaternion.multiply(
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        destination.geometry.coordinates[1] * Math.PI / -180,
        destination.geometry.coordinates[0] * Math.PI / 180,
        0,
        'YXZ'
      )
    )
  )
}

export function getOriginEuler() {
  return new THREE.Euler(0, 0, 0, 'YXZ')
    .setFromQuaternion(state.originTransform.quaternion.clone(), 'YXZ')
}

export function eulerToCoordinate(euler: THREE.Euler): Position {
  return [euler.y * 180 / Math.PI, euler.x * -180 / Math.PI]
}

export function coordinateToEuler(coordinate: Position): THREE.Euler {
  return new THREE.Euler(coordinate[1] * Math.PI / -180, coordinate[0] * Math.PI / 180, 0, 'YXZ')
}

export function getBearing(coordinate: Position, originCoordinateEuler?: THREE.Euler, originCoordinate?: Position) {
  if (!originCoordinateEuler)
    originCoordinateEuler = getOriginEuler()

  if (!originCoordinate)
    originCoordinate = eulerToCoordinate(originCoordinateEuler)

  return (turfBearing(originCoordinate, coordinate) - 90) * Math.PI / -180 - originCoordinateEuler.z
}

export function getRelativePosition(coordinate: Position, originCoordinateEuler?: THREE.Euler, originCoordinate?: Position, negativeElevation = -state.originTransform.elevation) {
  if (!originCoordinateEuler)
    originCoordinateEuler = getOriginEuler()

  if (!originCoordinate)
    originCoordinate = eulerToCoordinate(originCoordinateEuler)

  const distance = turfDistance(originCoordinate, coordinate, { units: 'meters' })

  const angle = getBearing(coordinate, originCoordinateEuler, originCoordinate)

  return new THREE.Vector3(
    Math.cos(angle) * distance,
    negativeElevation,
    Math.sin(-angle) * distance
  )
}

export function getMeridianAngle(coordinate: Position, originCoordinateEuler?: THREE.Euler, originCoordinate?: Position) {
  if (!originCoordinateEuler)
    originCoordinateEuler = getOriginEuler()

  if (!originCoordinate)
    originCoordinate = eulerToCoordinate(originCoordinateEuler)

  const vector = getRelativePosition([coordinate[0], coordinate[1] + 0.04], originCoordinateEuler, originCoordinate)
    .sub(getRelativePosition(coordinate, originCoordinateEuler, originCoordinate))

  return Math.atan2(-vector.x, -vector.z)
}

export type ProjectedLine = {
  centerCoordinate: Position;
  points: THREE.Vector3[];
}

export function getProjectedLines(featureCollection: FeatureCollection): ProjectedLine[] {
  return featureCollection.features.map(feature => {
    switch (feature.geometry.type) {
      case "LineString":
        const lineString = feature.geometry as LineString

        const centerCoordinate = pointOnFeature(lineString).geometry.coordinates
        const centerCoordinateEuler = coordinateToEuler(centerCoordinate)

        return {
          centerCoordinate,
          points: lineString.coordinates.map(coordinate => getRelativePosition(coordinate, centerCoordinateEuler, centerCoordinate, 0))
        }
      default:
        return undefined
    }
  }).filter(Boolean) as ProjectedLine[]
}

export type ProjectedLineAndLength = {
  projectedLine: ProjectedLine;
  length: number;
}
