import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { eulerToCoordinate, move, state as gisState } from '@/lib/gis'
import { state as trainsState, Axle, Bogie, CarBody } from '@/lib/trains'
import FeatureObject from './FeatureObject'
import { setCameraTargetPosition } from './cameras-and-controls/CameraControls'
import { gameState } from '@/lib/client'

function BogieModel({
  trainId,
  bogieIndex,
  bogie,
  isHovered,
  isActive,
  ...props
}: {
  trainId: string;
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
            trainsState.activeTrainId = ""
          } else {
            trainsState.activeBobyIndex = bogieIndex
            trainsState.activeTrainId = trainId
          }
        }}
        onPointerOver={() => {
          trainsState.hoveredBodyIndex = bogieIndex
          trainsState.hoveredTrainId = trainId
        }}
        onPointerOut={() => {
          trainsState.hoveredBodyIndex = -1
          trainsState.hoveredTrainId = ""
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
  trainId,
  bodyIndex,
  carBody,
  isHovered,
  isActive,
  ...props
}: {
  trainId: string;
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
          trainsState.activeTrainId = ""
        } else {
          trainsState.activeBobyIndex = bodyIndex
          trainsState.activeTrainId = trainId
        }
      }}
      onPointerOver={() => {
        trainsState.hoveredBodyIndex = bodyIndex
        trainsState.hoveredTrainId = trainId
      }}
      onPointerOut={() => {
        trainsState.hoveredBodyIndex = -1
        trainsState.hoveredTrainId = ""
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

export function onFrame() {
  // Track the camera to the selected car body
  if (trainsState.activeBobyIndex !== -1) {
    const selectedTrain = gameState.trains[trainsState.activeTrainId]
    const selectedBody = trainsState.activeBobyIndex < selectedTrain.bogies.length ? selectedTrain.bogies[trainsState.activeBobyIndex] : selectedTrain.otherBodies[trainsState.activeBobyIndex - selectedTrain.bogies.length]
    setCameraTargetPosition(eulerToCoordinate(selectedTrain.globalPosition), selectedBody.position.y)
    move(gisState.originTransform.quaternion, selectedBody.position.x, selectedBody.position.z)
  }
}

export default function Trains() {
  useSnapshot(gameState)
  useSnapshot(trainsState)

  return (
    <>
      {Object.keys(gameState.trains).map(trainId => {
        const train = gameState.trains[trainId]

        return (
          <FeatureObject key={trainId} centerCoordinate={eulerToCoordinate(train.globalPosition)}>
            {train.bogies.map((bogie, bogieIndex) => {
              const isActive = trainsState.activeTrainId === trainId && trainsState.activeBobyIndex === bogieIndex
              const isHovered = trainsState.hoveredTrainId === trainId && trainsState.hoveredBodyIndex === bogieIndex

              return (
                <BogieModel
                  key={bogieIndex}
                  trainId={trainId}
                  bogieIndex={bogieIndex}
                  bogie={bogie}
                  isActive={isActive}
                  isHovered={isHovered}
                />
              )
            })}
            {train.otherBodies.map((carBody, otherBodieIndex) => {
              const bodyIndex = otherBodieIndex + train.bogies.length
              const isActive = trainsState.activeTrainId === trainId && trainsState.activeBobyIndex === bodyIndex
              const isHovered = trainsState.hoveredTrainId === trainId && trainsState.hoveredBodyIndex === bodyIndex

              return (
                <OtherBodyModel
                  key={otherBodieIndex}
                  trainId={trainId}
                  bodyIndex={bodyIndex}
                  carBody={carBody}
                  isActive={isActive}
                  isHovered={isHovered}
                />
              )
            })}
          </FeatureObject>
        )
      })}
    </>
  )
}
