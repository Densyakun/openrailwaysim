import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { eulerToCoordinate, move, state as gisState } from '@/lib/gis'
import { IdentifiedRecord } from '@/lib/saveData'
import { state as trainsState, Train, getOneHandleMasterControllerOutput, getTractiveForcePerMotorCars, updateTime } from '@/lib/trains'
import FeatureObject from './FeatureObject'
import { setCameraTargetPosition } from './cameras-and-controls/CameraControls'

function BogieModel({ isHovered, isActive, ...props }: any) {
  return (
    <mesh {...props}>
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

function WheelAndAxleModel({ diameter, rotationX, ...props }: any) {
  return (
    <group {...props}>
      <mesh position={[0, diameter / 2, 0]} rotation={[rotationX, 0, Math.PI / 2]}>
        <cylinderGeometry args={[diameter / 2, diameter / 2, 1.267, 8]} />
        <meshStandardMaterial />
      </mesh>
    </group>
  )
}

function OtherBodyModel({ isHovered, isActive, ...props }: any) {
  return (
    <mesh {...props}>
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
  const { trains } = useSnapshot(trainsState)

  useFrame(({ }, delta) => {
    trainsState.trains.forEach(train => {
      updateTime(train, delta)

      // Track the camera to the selected bogie
      if (trainsState.activeBobyIndex !== -1) {
        const selectedTrain = trains[trainsState.activeTrainIndex]
        const selectedBody = trainsState.activeBobyIndex < selectedTrain.bogies.length ? selectedTrain.bogies[trainsState.activeBobyIndex] : selectedTrain.otherBodies[trainsState.activeBobyIndex - selectedTrain.bogies.length]
        setCameraTargetPosition(eulerToCoordinate(selectedTrain.globalPosition), selectedBody.position.y)
        move(gisState.originTransform.quaternion, selectedBody.position.x, selectedBody.position.z)
      }
    })
  })

  return (
    <>
      {(trains as (IdentifiedRecord & Train)[]).map((train, trainIndex) => (
        <FeatureObject key={trainIndex} centerCoordinate={eulerToCoordinate(train.globalPosition)}>
          {train.bogies.map(({ position: bogiePosition, rotation: bogieRotation, axles }, bogieIndex) => {
            const isActive = trainsState.activeTrainIndex === trainIndex && trainsState.activeBobyIndex === bogieIndex
            const isHovered = trainsState.hoveredTrainIndex === trainIndex && trainsState.hoveredBodyIndex === bogieIndex

            return (
              <>
                <BogieModel
                  key={bogieIndex}
                  position={bogiePosition.clone()}
                  rotation={bogieRotation.clone()}
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
                  isActive={isActive}
                  isHovered={isHovered}
                />
                {axles.map(({ position: axlePosition, rotation: axleRotation, diameter, rotationX }, axleIndex) => (
                  <WheelAndAxleModel
                    key={axleIndex}
                    position={axlePosition.clone()}
                    rotation={axleRotation.clone()}
                    diameter={diameter}
                    rotationX={rotationX}
                  />
                ))}
              </>
            )
          })}
          {train.otherBodies.map(({ position, rotation }, otherBodieIndex) => {
            const bodyIndex = otherBodieIndex + train.bogies.length
            const isActive = trainsState.activeTrainIndex === trainIndex && trainsState.activeBobyIndex === bodyIndex
            const isHovered = trainsState.hoveredTrainIndex === trainIndex && trainsState.hoveredBodyIndex === bodyIndex

            return (
              <OtherBodyModel
                key={otherBodieIndex}
                position={position.clone()}
                rotation={rotation.clone()}
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
