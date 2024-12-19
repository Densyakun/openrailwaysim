import * as React from 'react'
import * as THREE from 'three'
import { Instance, Instances, useGLTF } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { getRotationFromTwoPoints } from '@/lib/projectedLine'
import FeatureObject from './FeatureObject'
import { useFrame } from '@react-three/fiber'
import { gameState } from '@/lib/client'

function LineTrack({ from, to, meshChild }: { from: THREE.Vector3, to: THREE.Vector3, meshChild: THREE.Mesh }) {
  const groupRef = React.useRef<THREE.Group>(null)

  useFrame(() => {
    const rotation = getRotationFromTwoPoints(from, to)

    groupRef.current!.position.copy(from)
    groupRef.current!.rotation.copy(rotation)
    groupRef.current!.scale.set(1, 1, from.distanceTo(to))
  })

  return <group ref={groupRef}>
    <Instance
      position={meshChild.position}
      rotation={meshChild.rotation}
      scale={meshChild.scale}
    />
  </group>
}

export default function InstancedTracks() {
  const { scene } = useGLTF('https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-1067.gltf')

  const instancedMeshesRef = React.useRef<(THREE.InstancedMesh | null)[]>([])

  useSnapshot(gameState)

  return (
    <>
      {scene.children.map((child, index) => <Instances
        key={index}
        ref={el => instancedMeshesRef.current[index] = el}
        limit={1000}
        geometry={(child as THREE.Mesh).geometry}
        material={(child as THREE.Mesh).material}
        receiveShadow
        castShadow
      >
        {/*Object.keys(gameState.projectedLines).map(projectedLineId => {
          const { centerCoordinate, points } = gameState.projectedLines[projectedLineId]

          return <FeatureObject key={projectedLineId} centerCoordinate={centerCoordinate}>
            {points.map((nextPoint, index, array) => {
              if (index === 0) return null

              return <LineTrack key={index} from={array[index - 1]} to={nextPoint} meshChild={child as THREE.Mesh} />
            })}
          </FeatureObject>
        })*/}
      </Instances>)}
    </>
  )
}
