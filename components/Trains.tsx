import * as React from 'react'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { eulerToCoordinate } from '@/lib/gis'
import { IdentifiedRecord } from '@/lib/saveData'
import { state as trainsState, Train, rollAxles } from '@/lib/trains'
import FeatureObject from './FeatureObject'

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
