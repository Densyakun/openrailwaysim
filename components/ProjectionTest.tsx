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
import { state as gisState } from '@/lib/gis'
import FeatureObject from './FeatureObject'

const c: Position[] = []

const width = 8
const height = 9
for (let a = 0; a < width; a++) {
  for (let b = 0; b < height; b++) {
    c.push([360 * a / width - 180, 180 * b / (height - 1) - 90])
  }
}

export default function ProjectionTest() {
  const [a, setA] = React.useState(0)

  useFrame(() => {
    setA(a + 1)
  })

  return (
    <>
      {c.map((c, index) => (
        <FeatureObject key={index} centerCoordinate={c}>
          <mesh rotation={new THREE.Euler(Math.PI / -2, 0, 0, 'YXZ')}>
            <coneGeometry args={[5, 10, 4]} />
            <meshStandardMaterial color={
              1 <= (a / 30) % 2
                ? new THREE.Color(Math.floor(index / height) / width, 0, 0)
                : new THREE.Color(0, index % height / height, 0)
            } />
          </mesh>
        </FeatureObject>
      ))}
      <mesh position={new THREE.Vector3(0, -gisState.originTransform.elevation, 0)}>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial color="#00f" />
      </mesh>
    </>
  )
}
