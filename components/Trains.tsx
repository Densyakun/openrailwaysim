import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { eulerToCoordinate, move, state as gisState } from '@/lib/gis'
import { IdentifiedRecord } from '@/lib/saveData'
import { state as trainsState, Train, updateTime, Axle, Bogie, CarBody } from '@/lib/trains'
import FeatureObject from './FeatureObject'
import { setCameraTargetPosition } from './cameras-and-controls/CameraControls'

function BogieModel({
  trainIndex,
  bogieIndex,
  bogie,
  isHovered,
  isActive,
  ...props
}: {
  trainIndex: number;
  bogieIndex: number;
  bogie: Bogie;
  isHovered: boolean;
  isActive: boolean;
}) {
  const meshRef = React.useRef<THREE.Mesh>(null)

  useFrame(() => {
    meshRef.current!.position.copy(bogie.position)
    meshRef.current!.rotation.copy(bogie.rotation)
  })

  return (
    <>
      <mesh
        ref={meshRef}
        onClick={() => {
          if (isActive) {
            trainsState.activeBobyIndex = -1
            trainsState.activeTrainIndex = -1
          } else {
            trainsState.activeBobyIndex = bogieIndex
            trainsState.activeTrainIndex = trainIndex
          }
        }}
        onPointerOver={() => {
          trainsState.hoveredBodyIndex = bogieIndex
          trainsState.hoveredTrainIndex = trainIndex
        }}
        onPointerOut={() => {
          trainsState.hoveredBodyIndex = -1
          trainsState.hoveredTrainIndex = -1
        }}
        {...props}
      >
        <boxGeometry args={[1, 0.3, 3]} />
        {isHovered
          ? <meshBasicMaterial color="yellow" />
          : isActive
            ? <meshBasicMaterial color="red" />
            : <meshStandardMaterial />
        }
      </mesh>
      {bogie.axles.map((axle, axleIndex) => (
        <WheelAndAxleModel
          key={axleIndex}
          axle={axle}
        />
      ))}
    </>
  )
}

function WheelAndAxleModel({ axle, ...props }: { axle: Axle }) {
  const groupRef = React.useRef<THREE.Group>(null)

  useFrame(() => {
    groupRef.current!.position.copy(axle.position)
    groupRef.current!.rotation.copy(axle.rotation)
  })

  return (
    <group ref={groupRef} {...props}>
      <mesh position={[0, axle.diameter / 2, 0]} rotation={[axle.rotationX, 0, Math.PI / 2]}>
        <cylinderGeometry args={[axle.diameter / 2, axle.diameter / 2, 1.267, 8]} />
        <meshStandardMaterial />
      </mesh>
    </group>
  )
}

function OtherBodyModel({
  trainIndex,
  bodyIndex,
  carBody,
  isHovered,
  isActive,
  ...props
}: {
  trainIndex: number;
  bodyIndex: number;
  carBody: CarBody;
  isHovered: boolean;
  isActive: boolean;
}) {
  const meshRef = React.useRef<THREE.Mesh>(null)

  useFrame(() => {
    meshRef.current!.position.copy(carBody.position)
    meshRef.current!.rotation.copy(carBody.rotation)
  })

  return (
    <mesh
      ref={meshRef}
      onClick={() => {
        if (isActive) {
          trainsState.activeBobyIndex = -1
          trainsState.activeTrainIndex = -1
        } else {
          trainsState.activeBobyIndex = bodyIndex
          trainsState.activeTrainIndex = trainIndex
        }
      }}
      onPointerOver={() => {
        trainsState.hoveredBodyIndex = bodyIndex
        trainsState.hoveredTrainIndex = trainIndex
      }}
      onPointerOut={() => {
        trainsState.hoveredBodyIndex = -1
        trainsState.hoveredTrainIndex = -1
      }}
      {...props}
    >
      <boxGeometry args={[1, 0.3, 3]} />
      {isHovered
        ? <meshBasicMaterial color="yellow" />
        : isActive
          ? <meshBasicMaterial color="red" />
          : <meshStandardMaterial />
      }
    </mesh>
  )
}

export default function Trains() {
  useSnapshot(trainsState)

  useFrame(({ }, delta) => {
    trainsState.trains.forEach(train => {
      updateTime(train, delta)

      // Track the camera to the selected bogie
      if (trainsState.activeBobyIndex !== -1) {
        const selectedTrain = trainsState.trains[trainsState.activeTrainIndex]
        const selectedBody = trainsState.activeBobyIndex < selectedTrain.bogies.length ? selectedTrain.bogies[trainsState.activeBobyIndex] : selectedTrain.otherBodies[trainsState.activeBobyIndex - selectedTrain.bogies.length]
        setCameraTargetPosition(eulerToCoordinate(selectedTrain.globalPosition), selectedBody.position.y)
        move(gisState.originTransform.quaternion, selectedBody.position.x, selectedBody.position.z)
      }
    })
  })

  return (
    <>
      {(trainsState.trains as (IdentifiedRecord & Train)[]).map((train, trainIndex) => (
        <FeatureObject key={trainIndex} centerCoordinate={eulerToCoordinate(train.globalPosition)}>
          {train.bogies.map((bogie, bogieIndex) => {
            const isActive = trainsState.activeTrainIndex === trainIndex && trainsState.activeBobyIndex === bogieIndex
            const isHovered = trainsState.hoveredTrainIndex === trainIndex && trainsState.hoveredBodyIndex === bogieIndex

            return (
              <BogieModel
                key={bogieIndex}
                trainIndex={trainIndex}
                bogieIndex={bogieIndex}
                bogie={bogie}
                isActive={isActive}
                isHovered={isHovered}
              />
            )
          })}
          {train.otherBodies.map((carBody, otherBodieIndex) => {
            const bodyIndex = otherBodieIndex + train.bogies.length
            const isActive = trainsState.activeTrainIndex === trainIndex && trainsState.activeBobyIndex === bodyIndex
            const isHovered = trainsState.hoveredTrainIndex === trainIndex && trainsState.hoveredBodyIndex === bodyIndex

            return (
              <OtherBodyModel
                key={otherBodieIndex}
                trainIndex={trainIndex}
                bodyIndex={bodyIndex}
                carBody={carBody}
                isActive={isActive}
                isHovered={isHovered}
              />
            )
          })}
        </FeatureObject>
      ))}
    </>
  )
}
