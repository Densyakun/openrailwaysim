import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { Instance, Instances } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { IdentifiedRecord } from '@/lib/saveData'
import { Bogie, state as bogiesState } from '@/lib/bogies'
import FeatureObject from './FeatureObject'

function Model(props: any) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.43, 0.43, 1.267, 8]} />
        <meshStandardMaterial />
      </mesh>
    </group>
  )
}

export default function WheelAndAxle() {
  const groupsRef = React.useRef<(THREE.Group | null)[][]>([])

  const { bogies } = useSnapshot(bogiesState)

  useFrame(() => {
    (bogiesState.bogies as (IdentifiedRecord & Bogie)[]).forEach(({ id, axles }) =>
      axles.forEach(({ positionAndRotation }, index) => {
        if (positionAndRotation === undefined) return null

        const group = (groupsRef.current[id] ? groupsRef.current[id] : groupsRef.current[id] = [])[index]
        group?.position.copy(positionAndRotation.position)
        group?.rotation.copy(positionAndRotation.rotation)
      })
    )
  })

  return (
    <>
      {/*(bogies as (IdentifiedRecord & Bogie)[]).map(({ axles }) =>
        axles.map(({ pointOnTrack, positionAndRotation }, index) => {
          if (positionAndRotation === undefined) return null

          return <FeatureObject key={index} centerCoordinate={pointOnTrack.projectedLine.centerCoordinate}>
            <Model
              position={positionAndRotation.position}
              rotation={positionAndRotation.rotation}
            />
          </FeatureObject>
        })
      )*/}
      <Instances
        limit={1000}
        receiveShadow
        castShadow
      >
        <cylinderGeometry args={[0.43, 0.43, 1.267, 8]} />
        <meshStandardMaterial />
        {(bogies as (IdentifiedRecord & Bogie)[]).map(({ id, axles }) =>
          <React.Fragment key={id}>
            {axles.map(({ pointOnTrack, positionAndRotation }, index) => {
              if (positionAndRotation === undefined) return null

              return <FeatureObject key={index} centerCoordinate={pointOnTrack.projectedLine.centerCoordinate}>
                <group
                  ref={el => (groupsRef.current[id] ? groupsRef.current[id] : groupsRef.current[id] = [])[index] = el}
                  position={positionAndRotation.position}
                  rotation={positionAndRotation.rotation}
                >
                  <Instance rotation={[0, 0, Math.PI / 2]} />
                </group>
              </FeatureObject>
            })}
          </React.Fragment>
        )}
      </Instances>
    </>
  )
}
