import * as THREE from 'three'
import { Position } from '@turf/helpers'
import { default as turfBearing } from '@turf/bearing'
import { default as turfDestination } from '@turf/destination'
import { default as turfDistance } from '@turf/distance'
import { point as turfPoint } from '@turf/helpers'
import { proxy } from 'valtio'

export const sphericalEarthMeridianLength = turfDistance([0, -90], [0, 90], { units: 'meters' })

export const state = proxy<{
  originQuaternion: THREE.Quaternion;
  elevation: number;
}>({
  originQuaternion: new THREE.Quaternion(),
  elevation: 0,
})

export function move(pointQuaternion: THREE.Quaternion, moveX: number, moveZ: number, elevation = state.elevation) {
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
    .setFromQuaternion(state.originQuaternion.clone(), 'YXZ')
}

export function getRelativeRotation(coordinate: Position, originCoordinateEuler?: THREE.Euler, originCoordinate?: Position) {
  if (!originCoordinateEuler)
    originCoordinateEuler = getOriginEuler()

  if (!originCoordinate)
    originCoordinate = [originCoordinateEuler.y * 180 / Math.PI, originCoordinateEuler.x * -180 / Math.PI]

  return (turfBearing(originCoordinate, coordinate) - 90) * Math.PI / -180 - originCoordinateEuler.z
}

export function getRelativePosition(coordinate: Position) {
  const coordinateEuler = getOriginEuler()

  const originCoordinate = [coordinateEuler.y * 180 / Math.PI, coordinateEuler.x * -180 / Math.PI]

  const distance = turfDistance(originCoordinate, coordinate, { units: 'meters' })

  const angle = getRelativeRotation(coordinate, coordinateEuler, originCoordinate)

  return new THREE.Vector3(
    Math.cos(angle) * distance,
    -state.elevation,
    Math.sin(-angle) * distance
  )
}
