import * as React from 'react'
import * as THREE from 'three'
import { proxy, useSnapshot } from 'valtio'
import { ProjectedLine } from '@/lib/gis'
import { getRotationFromTwoPoints } from '@/lib/projectedLine'
import { IdentifiedRecord } from '@/lib/saveData'
import FeatureObject from './FeatureObject'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

export const state = proxy<{
  projectedLines: (IdentifiedRecord & ProjectedLine)[];
}>({
  projectedLines: [],
})

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

  useSnapshot(state)

  return (
    <>
      {(state.projectedLines as (IdentifiedRecord & ProjectedLine)[]).map(({ id, centerCoordinate, points }) => {
        return <FeatureObject key={id} centerCoordinate={centerCoordinate}>
          {points.map((nextPoint, index, array) => {
            if (index === 0) return null

            return <LineTrack key={index} from={array[index - 1]} to={nextPoint} object={scene} />
          })}
        </FeatureObject>
      })}
    </>
  )
}
