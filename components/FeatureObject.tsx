import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Position } from '@turf/helpers'
import { getRelativePosition, getOriginEuler, eulerToCoordinate, getMeridianAngle } from '@/lib/gis'

function getRotation(centerCoordinate: Position, originCoordinateEuler?: THREE.Euler, originCoordinate?: Position) {
  return new THREE.Euler(0, getMeridianAngle(centerCoordinate, originCoordinateEuler, originCoordinate), 0, 'YXZ')
}

export default function FeatureObject({
  children,
  centerCoordinate,
}: {
  children: React.ReactNode;
  centerCoordinate?: Position;
}) {
  let originCoordinateEuler = getOriginEuler()
  let originCoordinate = eulerToCoordinate(originCoordinateEuler)

  if (!centerCoordinate)
    centerCoordinate = originCoordinate

  const groupRef = React.useRef<THREE.Group>(null)
  useFrame(() => {
    originCoordinateEuler = getOriginEuler()
    originCoordinate = eulerToCoordinate(originCoordinateEuler)

    const centerPosition = getRelativePosition(centerCoordinate!, originCoordinateEuler, originCoordinate)
    const rotation = getRotation(centerCoordinate!, originCoordinateEuler, originCoordinate)

    groupRef.current!.position.copy(centerPosition)
    groupRef.current!.rotation.copy(rotation)
  })

  return (
    <>
      <group ref={groupRef}>
        {children}
      </group>
    </>
  )
}
