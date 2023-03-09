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

  const [centerPosition, setCenterPosition] = React.useState<THREE.Vector3>(getRelativePosition(centerCoordinate, originCoordinateEuler, originCoordinate))
  const [rotation, setRotation] = React.useState(getRotation(centerCoordinate, originCoordinateEuler, originCoordinate))

  useFrame(() => {
    originCoordinateEuler = getOriginEuler()
    originCoordinate = eulerToCoordinate(originCoordinateEuler)

    setCenterPosition(getRelativePosition(centerCoordinate!, originCoordinateEuler, originCoordinate))
    setRotation(getRotation(centerCoordinate!, originCoordinateEuler, originCoordinate))
  })

  return (
    <>
      <group position={centerPosition} rotation={rotation}>
        {children}
      </group>
    </>
  )
}
