import * as React from 'react'
import * as THREE from 'three'
//import { Line } from '@react-three/drei'
import { Instance, Instances, useGLTF } from '@react-three/drei'
import { proxy, useSnapshot } from 'valtio'
import { ProjectedLine } from '@/lib/gis'
import { getRotationFromTwoPoints } from '@/lib/projectedLine'
import { IdentifiedRecord } from '@/lib/saveData'
import FeatureObject from './FeatureObject'

export const state = proxy<{
  projectedLines: (IdentifiedRecord & ProjectedLine)[];
}>({
  projectedLines: [],
})

export default function Tracks() {
  const { scene } = useGLTF('https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-1067.gltf')

  const instancedMeshesRef = React.useRef<(THREE.InstancedMesh | null)[]>([])

  const { projectedLines } = useSnapshot(state)

  return (
    <>
      {/*(projectedLines as (IdentifiedRecord & ProjectedLine)[]).map(({ id, centerCoordinate, points }) => {
        return <FeatureObject key={id} centerCoordinate={centerCoordinate}>
          <Line points={points} />
        </FeatureObject>
      })*/}
      {scene.children.map((child, index) => <Instances
        key={index}
        ref={el => instancedMeshesRef.current[index] = el}
        limit={1000}
        geometry={(child as THREE.Mesh).geometry}
        material={(child as THREE.Mesh).material}
        receiveShadow
        castShadow
      >
        {(projectedLines as (IdentifiedRecord & ProjectedLine)[]).map(({ id, centerCoordinate, points }) => {
          return <FeatureObject key={id} centerCoordinate={centerCoordinate}>
            {points.map((nextPoint, index, array) => {
              if (index === 0) return null

              const prevPoint = array[index - 1]

              const rotation = getRotationFromTwoPoints(prevPoint, nextPoint)

              return <group
                key={index}
                position={prevPoint}
                rotation={rotation}
                scale={new THREE.Vector3(1, 1, prevPoint.distanceTo(nextPoint))}
              >
                <Instance
                  position={(child as THREE.Mesh).position}
                  rotation={(child as THREE.Mesh).rotation}
                  scale={(child as THREE.Mesh).scale}
                />
              </group>
            })}
          </FeatureObject>
        })}
      </Instances>)}
    </>
  )
}
