import * as THREE from 'three'
import { Position } from '@turf/helpers'
import { default as turfBearing } from '@turf/bearing'
import { default as turfDistance } from '@turf/distance'
import { proxy } from 'valtio'

export const sphericalEarthMeridianLength = turfDistance([0, -90], [0, 90], { units: 'meters' })

export const state = proxy<{
  originQuaternion: THREE.Quaternion;
  elevation: number;
}>({
  originQuaternion: new THREE.Quaternion(),
  elevation: 0,
})

export function move(q: THREE.Quaternion, moveVector: THREE.Vector3) {
  const meridianLength = (sphericalEarthMeridianLength / Math.PI + moveVector.y) * Math.PI

  return q.multiply(
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(moveVector.z * Math.PI / meridianLength, moveVector.x * Math.PI / meridianLength, 0, 'YXZ')
    )
  )
}

export function getOriginEuler() {
  return new THREE.Euler(0, 0, 0, 'YXZ')
    .setFromQuaternion(state.originQuaternion.clone(), 'YXZ')
}

export function getRelativePosition(coordinate: Position) {
  const coordinateEuler = getOriginEuler()

  const originCoordinate = [coordinateEuler.y * 180 / Math.PI, coordinateEuler.x * -180 / Math.PI]

  const distance = turfDistance(originCoordinate, coordinate, { units: 'meters' })

  const angle = (turfBearing(originCoordinate, coordinate) - 90) * Math.PI / -180

  return new THREE.Vector3(
    Math.cos(angle) * distance,
    -state.elevation,
    Math.sin(-angle) * distance
  ).applyAxisAngle(new THREE.Vector3(0, 1, 0), coordinateEuler.z)
}
