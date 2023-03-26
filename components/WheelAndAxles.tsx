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
      axles.forEach(({ position, rotation }, index) => {
        const group = (groupsRef.current[id] ? groupsRef.current[id] : groupsRef.current[id] = [])[index]
        group?.position.copy(position)
        group?.rotation.copy(rotation)
      })
    )
  })

  return (
    <>
      {/*(bogies as (IdentifiedRecord & Bogie)[]).map(({ id, centerCoordinate, axles }) => (
        <FeatureObject key={id} centerCoordinate={centerCoordinate}>
          {axles.map(({ position, rotation }, index) => (
            <AxleModel
              key={index}
              position={position}
              rotation={rotation}
            />
          ))}
        </FeatureObject>
      ))*/}
      <Instances
        limit={1000}
        receiveShadow
        castShadow
      >
        <cylinderGeometry args={[0.43, 0.43, 1.267, 8]} />
        <meshStandardMaterial />
        {(bogies as (IdentifiedRecord & Bogie)[]).map(({ id, centerCoordinate, axles }) => (
          <FeatureObject key={id} centerCoordinate={centerCoordinate}>
            {axles.map(({ position, rotation }, index) => (
              <group
                ref={el => (groupsRef.current[id] ? groupsRef.current[id] : groupsRef.current[id] = [])[index] = el}
                position={position}
                rotation={rotation}
              >
                <Instance rotation={[0, 0, Math.PI / 2]} />
              </group>
            ))}
          </FeatureObject>
        ))}
      </Instances>
    </>
  )
}
