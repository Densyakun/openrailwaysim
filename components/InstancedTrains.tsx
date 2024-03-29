import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { Instance, Instances } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { eulerToCoordinate } from '@/lib/gis'
import FeatureObject from './FeatureObject'
import { gameState } from '@/lib/client'

export default function InstancedTrains() {
  const bogieGroupsRef = React.useRef<(THREE.Group | null)[]>([])
  const axleGroupsRef = React.useRef<(THREE.Group | null)[][]>([])
  const otherBodyGroupsRef = React.useRef<(THREE.Group | null)[]>([])

  useSnapshot(gameState)

  // TODO Correctly display multiple train locations
  useFrame(() => {
    Object.keys(gameState.trains).forEach(trainId => {
      const train = gameState.trains[trainId]

      train.bogies.forEach(({ position, rotation, axles }, bogieIndex) => {
        const bogieGroup = bogieGroupsRef.current[bogieIndex]
        bogieGroup?.position.copy(position)
        bogieGroup?.rotation.copy(rotation)

        axles.forEach(({ position, rotation }, axleIndex) => {
          const axleGroup = (axleGroupsRef.current[bogieIndex] ? axleGroupsRef.current[bogieIndex] : axleGroupsRef.current[bogieIndex] = [])[axleIndex]
          axleGroup?.position.copy(position)
          axleGroup?.rotation.copy(rotation)
        })
      })
      train.otherBodies.forEach(({ position, rotation }, otherBodyIndex) => {
        const otherBodyGroup = otherBodyGroupsRef.current[otherBodyIndex]
        otherBodyGroup?.position.copy(position)
        otherBodyGroup?.rotation.copy(rotation)
      })
    })
  })

  const bogieInstances: JSX.Element[] = []
  const axleInstances: JSX.Element[] = []
  const otherBodyInstances: JSX.Element[] = [];

  Object.keys(gameState.trains).forEach(trainId => {
    const train = gameState.trains[trainId]

    const centerCoordinate = eulerToCoordinate(train.globalPosition)

    train.bogies.forEach(({ position, rotation, axles }, bogieIndex) => {
      bogieInstances.push(
        <FeatureObject key={bogieIndex} centerCoordinate={centerCoordinate}>
          <group
            ref={el => bogieGroupsRef.current[bogieIndex] = el}
            position={position}
            rotation={rotation}
          >
            <Instance />
          </group>
        </FeatureObject>
      )

      axleInstances.push(
        <FeatureObject key={bogieIndex} centerCoordinate={centerCoordinate}>
          {axles.map(({ position, rotation }, axleIndex) => (
            <group
              key={axleIndex}
              ref={el => (axleGroupsRef.current[bogieIndex] ? axleGroupsRef.current[bogieIndex] : axleGroupsRef.current[bogieIndex] = [])[axleIndex] = el}
              position={position}
              rotation={rotation}
            >
              <Instance rotation={[0, 0, Math.PI / 2]} />
            </group>
          ))}
        </FeatureObject>
      )
    })

    train.otherBodies.forEach(({ position, rotation }, otherBodyIndex) => {
      otherBodyInstances.push(
        <FeatureObject key={otherBodyIndex} centerCoordinate={centerCoordinate}>
          <group
            ref={el => otherBodyGroupsRef.current[otherBodyIndex] = el}
            position={position}
            rotation={rotation}
          >
            <Instance />
          </group>
        </FeatureObject>
      )
    })
  })

  return (
    <>
      <Instances
        limit={1000}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[1, 0.3, 3]} />
        <meshStandardMaterial />
        {bogieInstances}
      </Instances>
      <Instances
        limit={1000}
        receiveShadow
        castShadow
      >
        <cylinderGeometry args={[0.43, 0.43, 1.267, 8]} />
        <meshStandardMaterial />
        {axleInstances}
      </Instances>
      <Instances
        limit={1000}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[1, 0.3, 3]} />
        <meshStandardMaterial />
        {otherBodyInstances}
      </Instances>
    </>
  )
}
