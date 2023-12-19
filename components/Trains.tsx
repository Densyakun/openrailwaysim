import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { eulerToCoordinate, move, state as gisState } from '@/lib/gis'
import { IdentifiedRecord } from '@/lib/saveData'
import { state as trainsState, Train, rollAxles, getOneHandleMasterControllerOutput, getTractiveForcePerMotorCars } from '@/lib/trains'
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
      <mesh rotation={[rotationX, 0, Math.PI / 2]}>
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
      // Run a trains
      rollAxles(train, train.speed * delta)

      // Track the camera to the selected bogie
      if (trainsState.activeBobyIndex !== -1) {
        const selectedTrain = trains[trainsState.activeTrainIndex]
        const selectedBody = trainsState.activeBobyIndex < selectedTrain.bogies.length ? selectedTrain.bogies[trainsState.activeBobyIndex] : selectedTrain.otherBodies[trainsState.activeBobyIndex - selectedTrain.bogies.length]
        setCameraTargetPosition(eulerToCoordinate(selectedTrain.globalPosition), selectedBody.position.y)
        move(gisState.originTransform.quaternion, selectedBody.position.x, selectedBody.position.z)
      }

      // 自動でマスコンと主制御器（Control System）を接続する
      let accel = 0
      let brake = 1
      train.bogies.forEach(bogie => {
        bogie.masterControllers.forEach(masterController => {
          const [accel1, brake1] = getOneHandleMasterControllerOutput(masterController)

          accel = Math.max(accel, accel1)
          brake = Math.min(brake, brake1)
        })
      })
      train.otherBodies.forEach(body => {
        body.masterControllers.forEach(masterController => {
          const [accel1, brake1] = getOneHandleMasterControllerOutput(masterController)

          accel = Math.max(accel, accel1)
          brake = Math.min(brake, brake1)
        })
      })

      // TODO 引張力、電動機、電流、重量、速度などから計算する

      //const voltage = 1100
      const fieldCoil = 1 // 界磁 (0-1)
      const tractiveForce = getTractiveForcePerMotorCars(train.speed/*, voltage, fieldCoil*/) // 引張力 (kg)
      const a = 30.9

      //const acceleration = 3.0 / 3.6 // 3.0 km/h/s
      console.log(accel)
      const acceleration = tractiveForce * train.motorCars / train.weight / a / 3.6
      const deceleration = 4.5 / 3.6 // 4.5 km/h/s
      train.speed += accel * acceleration * delta
      train.speed =
        0 <= train.speed
          ? Math.max(0, train.speed - brake * deceleration * delta)
          : Math.min(0, train.speed + brake * deceleration * delta)
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
