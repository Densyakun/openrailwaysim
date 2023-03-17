import * as React from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three-stdlib'
import { useLoader } from '@react-three/fiber'
//import { Line } from '@react-three/drei'
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

function Rail(props: any) {
  const { scene } = useLoader(GLTFLoader, 'https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50kgn-1067.gltf')

  return (
    <primitive {...props} object={scene.clone()} />
  )
}

export default function Tracks() {
  const { projectedLines } = useSnapshot(state)

  return (
    <>
      {(projectedLines as (IdentifiedRecord & ProjectedLine)[]).map((projectedLine, index) => {
        return <FeatureObject key={index} centerCoordinate={projectedLine.centerCoordinate}>
          {/*<Line points={projectedLine.points} />*/}
          {projectedLine.points.map((point, index, array) => {
            if (array.length <= index + 1) return undefined

            return <Rail
              key={index}
              position={point}
              rotation={getRotationFromTwoPoints(point, array[index + 1])}
              scale={new THREE.Vector3(1, 1, point.distanceTo(array[index + 1]))}
            />
          })}
        </FeatureObject>
      })}
    </>
  )
}
