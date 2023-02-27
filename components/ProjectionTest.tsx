/*
gis.ts:

export const sphericalEarthMeridianLength_ = turfDistance([0, -90], [0, 90], { units: 'meters' })
export const sphericalEarthMeridianLength = 100

export function getRelativePosition(coordinate: Position) {
  ...

  const distance = turfDistance(originCoordinate, coordinate, { units: 'meters' })
    * sphericalEarthMeridianLength / sphericalEarthMeridianLength_

  ...
}

export function move(...) {
  ...

  const distance = Math.sqrt(moveX ** 2 + moveZ ** 2)
    * (sphericalEarthMeridianLength / ((sphericalEarthMeridianLength / Math.PI + elevation) * Math.PI))
    * sphericalEarthMeridianLength_ / sphericalEarthMeridianLength

  ...
}
*/
import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Position } from '@turf/helpers'
import { getRelativePosition, getOriginEuler, state as gisState } from '@/lib/gis'

const c: Position[] = []

const width = 7
const height = 8
for (let a = 0; a < width; a++) {
  for (let b = 0; b < height; b++) {
    c.push([360 * a / width - 180, 180 * b / (height - 1) - 90])
  }
}

export default function ProjectionTest() {
  const [objPositions, setObjPositions] = React.useState<THREE.Vector3[]>([])
  const [objRotation, setObjRotation] = React.useState(new THREE.Euler(0, -getOriginEuler().z, 0))
  const [a, setA] = React.useState(0)

  useFrame(() => {
    setObjPositions(c.map(c => getRelativePosition(c)))
    setObjRotation(new THREE.Euler(0, -getOriginEuler().z, 0))
    setA(a + 1)
  })

  return (
    <>
      {objPositions.map((objPosition, index) => (
        <mesh key={index} position={objPosition} rotation={objRotation}>
          <boxGeometry args={[10, 10, 10]} />
          <meshStandardMaterial color={
            1 <= (a / 30) % 2
              ? new THREE.Color(Math.floor(index / height) / width, 0, 0)
              : new THREE.Color(0, index % height / height, 0)
          } />
        </mesh>
      ))}
      <mesh position={new THREE.Vector3(0, -gisState.elevation, 0)}>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial color="#00f" />
      </mesh>
    </>
  )
}
