import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { eulerToCoordinate, state as gisState, move } from '@/lib/gis'
import { IdentifiedRecord } from '@/lib/saveData'
import { state as trainsState, Train, rollAxles, getOneHandleMasterControllerOutput, state } from '@/lib/trains'
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

function OtherBodyModel(props: any) {
  return (
    <mesh {...props}>
      <boxGeometry args={[1, 0.3, 3]} />
      <meshStandardMaterial />
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
      if (state.activeBogieIndex !== -1) {
        const selectedTrain = trains[state.activeTrainIndex]
        const selectedBogie = selectedTrain.bogies[state.activeBogieIndex]
        setCameraTargetPosition(eulerToCoordinate(selectedTrain.globalPosition), selectedBogie.position.y)
        move(gisState.originTransform.quaternion, selectedTrain.bogies[0].position.x, selectedTrain.bogies[0].position.z)
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

      const acceleration = 3.0 / 3.6 // 3.0 km/h/s
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
            const isActive = trainsState.activeTrainIndex === trainIndex && trainsState.activeBogieIndex === bogieIndex
            const isHovered = trainsState.hoveredTrainIndex === trainIndex && trainsState.hoveredBogieIndex === bogieIndex

            return (
              <>
                <BogieModel
                  key={bogieIndex}
                  position={bogiePosition.clone()}
                  rotation={bogieRotation.clone()}
                  onClick={() => {
                    if (isActive) {
                      trainsState.activeBogieIndex = -1
                      trainsState.activeTrainIndex = -1
                    } else {
                      trainsState.activeBogieIndex = bogieIndex
                      trainsState.activeTrainIndex = trainIndex
                    }
                  }}
                  onPointerOver={() => {
                    trainsState.hoveredBogieIndex = bogieIndex
                    trainsState.hoveredTrainIndex = trainIndex
                  }}
                  onPointerOut={() => {
                    trainsState.hoveredBogieIndex = -1
                    trainsState.hoveredTrainIndex = -1
                  }}
                  isActive={isActive}
                  isHovered={isHovered}
                />
                {axles.map(({ position: axlePosition, rotation: axleRotation }, axleIndex) => (
                  <WheelAndAxleModel
                    key={axleIndex}
                    position={axlePosition.clone()}
                    rotation={axleRotation.clone()}
                  />
                ))}
              </>
            )
          })}
          {train.otherBodies.map(({ position, rotation }, otherBodieIndex) => (
            <OtherBodyModel
              key={otherBodieIndex}
              position={position.clone()}
              rotation={rotation.clone()}
            />
          ))}
        </FeatureObject>
      ))}
    </>
  )
}
