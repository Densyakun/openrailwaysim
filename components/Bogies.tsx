import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { Instance, Instances } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { IdentifiedRecord } from '@/lib/saveData'
import { Bogie, state as bogiesState } from '@/lib/bogies'
import FeatureObject from './FeatureObject'

function WheelAndAxleModel(props: any) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.43, 0.43, 1.267, 8]} />
        <meshStandardMaterial />
      </mesh>
    </group>
  )
}

export default function Bogies() {
  const bogieGroupsRef = React.useRef<(THREE.Group | null)[]>([])
  const axleGroupsRef = React.useRef<(THREE.Group | null)[][]>([])

  const { bogies } = useSnapshot(bogiesState)

  useFrame(() => {
    (bogiesState.bogies as (IdentifiedRecord & Bogie)[]).forEach(({ id, position, rotation, axles }) => {
      const bogieGroup = bogieGroupsRef.current[id]
      bogieGroup?.position.copy(position)
      bogieGroup?.rotation.copy(rotation)

      axles.forEach(({ position, rotation }, index) => {
        const axleGroup = (axleGroupsRef.current[id] ? axleGroupsRef.current[id] : axleGroupsRef.current[id] = [])[index]
        axleGroup?.position.copy(position)
        axleGroup?.rotation.copy(rotation)
      })
    })
  })

  const bogieInstances: JSX.Element[] = []
  const axleInstances: JSX.Element[] = [];

  (bogies as (IdentifiedRecord & Bogie)[]).forEach(({ id, centerCoordinate, position, rotation, axles }) => {
    bogieInstances.push(
      <FeatureObject key={id} centerCoordinate={centerCoordinate}>
        <group
          ref={el => bogieGroupsRef.current[id] = el}
          position={position}
          rotation={rotation}
        >
          <Instance rotation={[0, 0, Math.PI / 2]} />
        </group>
      </FeatureObject>
    )

    axleInstances.push(
      <FeatureObject key={id} centerCoordinate={centerCoordinate}>
        {axles.map(({ position, rotation }, index) => (
          <group
            key={index}
            ref={el => (axleGroupsRef.current[id] ? axleGroupsRef.current[id] : axleGroupsRef.current[id] = [])[index] = el}
            position={position}
            rotation={rotation}
          >
            <Instance rotation={[0, 0, Math.PI / 2]} />
          </group>
        ))}
      </FeatureObject>
    )
  });

  return (
    <>
      <Instances
        limit={1000}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
        {bogieInstances}
      </Instances>
      {/*(bogies as (IdentifiedRecord & Bogie)[]).map(({ id, centerCoordinate, axles }) => (
        <FeatureObject key={id} centerCoordinate={centerCoordinate}>
          {axles.map(({ position, rotation }, index) => (
            <WheelAndAxleModel
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
        {axleInstances}
      </Instances>
    </>
  )
}
