import * as THREE from 'three'

export function getRotationFromTwoPoints(point: THREE.Vector3, nextPoint: THREE.Vector3) {
  const euler = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      nextPoint.clone().sub(point).normalize()
    ), 'YXZ'
  )
  euler.z = 0
  return euler
}

export type Segment = {
  point: THREE.Vector3;
  nextPoint: THREE.Vector3;
  distance: number;
  lengthFromStartingPointToNextPoint: number;
}

export function getSegment(points: THREE.Vector3[], length: number) {
  let lengthFromStartingPointToNextPoint = 0
  let point!: THREE.Vector3
  let nextPoint!: THREE.Vector3
  let distance!: number

  for (let index = 1; index < points.length; index++) {
    distance = (point = points[index - 1]).distanceTo(nextPoint = points[index])
    lengthFromStartingPointToNextPoint += distance
    if (length <= lengthFromStartingPointToNextPoint)
      break
  }

  return { point, nextPoint, distance, lengthFromStartingPointToNextPoint } as Segment
}

export function getPositionFromLength({ point, nextPoint, distance, lengthFromStartingPointToNextPoint }: Segment, length: number) {
  const m = (length + distance - lengthFromStartingPointToNextPoint) / distance
  return new THREE.Vector3(
    point.x + (nextPoint.x - point.x) * m,
    point.y + (nextPoint.y - point.y) * m,
    point.z + (nextPoint.z - point.z) * m
  )
}
