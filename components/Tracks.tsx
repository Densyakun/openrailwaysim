import * as React from 'react'
import * as THREE from 'three'
import { useSnapshot } from 'valtio'
import { getRotationFromTwoPoints } from '@/lib/projectedLine'
import FeatureObject from './FeatureObject'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { gameState } from '@/lib/client'

function LineTrack({ from, to, object }: { from: THREE.Vector3, to: THREE.Vector3, object: THREE.Group }) {
  const groupRef = React.useRef<THREE.Group>(null)

  useFrame(() => {
    const rotation = getRotationFromTwoPoints(from, to)

    groupRef.current!.position.copy(from)
    groupRef.current!.rotation.copy(rotation)
    groupRef.current!.scale.set(1, 1, from.distanceTo(to))
  })

  return <group ref={groupRef}>
    {object.children.map((child, index) => (
      <mesh
        key={index}
        castShadow
        receiveShadow
        position={(child as THREE.Mesh).position}
        rotation={(child as THREE.Mesh).rotation}
        scale={(child as THREE.Mesh).scale}
        geometry={(child as THREE.Mesh).geometry}
        material={(child as THREE.Mesh).material}
      />
    ))}
  </group>
}

export default function Tracks() {
  const { scene } = useGLTF('https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-1067.gltf')

  useSnapshot(gameState)

  return (
    <>
      {Object.keys(gameState.projectedLines).map(projectedLineId => {
        const { centerCoordinate, points } = gameState.projectedLines[projectedLineId]

        return <FeatureObject key={projectedLineId} centerCoordinate={centerCoordinate}>
          {points.map((nextPoint, index, array) => {
            if (index === 0) return null

            return <LineTrack key={index} from={array[index - 1]} to={nextPoint} object={scene} />
          })}
        </FeatureObject>
      })}
    </>
  )
}
