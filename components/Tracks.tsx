import * as React from 'react'
import * as THREE from 'three'
import { useSnapshot } from 'valtio'
import { getRotationFromTwoPoints } from '@/lib/projectedLine'
import FeatureObject from './FeatureObject'
import { useFrame } from '@react-three/fiber'
import { Line, useGLTF } from '@react-three/drei'
import { gameState } from '@/lib/client'
import { getPosition, state as tracksState } from '@/lib/tracks'
import { guiState } from './gui/GUI'
import { tracksSubMenuState } from './gui/TracksSubMenu'

export function getNumberOfCurvePoints(length: number, radius: number) {
  const radius_ = Math.abs(radius)
  const l = Math.acos((radius_ - 0.1) / radius_) * 2 * radius_
  return Math.max(3, Math.ceil(length / l))
}

function LineTrack({
  from,
  to,
  object,
  isHovered,
  isSelected,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  object: THREE.Group;
  isHovered: boolean;
  isSelected: boolean;
}) {
  const groupRef = React.useRef<THREE.Group>(null)

  useFrame(() => {
    const rotation = getRotationFromTwoPoints(from, to)

    groupRef.current!.position.copy(from)
    groupRef.current!.rotation.copy(rotation)
    groupRef.current!.scale.set(1, 1, from.distanceTo(to))
  })

  return <group ref={groupRef}>
    {object.children.map((child, index) => (
      <mesh
        key={index}
        castShadow
        receiveShadow
        position={(child as THREE.Mesh).position}
        rotation={(child as THREE.Mesh).rotation}
        scale={(child as THREE.Mesh).scale}
        geometry={(child as THREE.Mesh).geometry}
        material={isHovered ? new THREE.MeshBasicMaterial({ color: "#ff0" }) :
          isSelected ? new THREE.MeshBasicMaterial({ color: "#f00" }) :
            (child as THREE.Mesh).material}
      />
    ))}
  </group>
}

export default function Tracks() {
  const { scene } = useGLTF('https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-1067.gltf')

  useSnapshot(gameState)
  useSnapshot(tracksSubMenuState)

  return (
    <>
      {/*Object.keys(gameState.projectedLines).map(projectedLineId => {
        const { centerCoordinate, points } = gameState.projectedLines[projectedLineId]

        return <FeatureObject key={projectedLineId} centerCoordinate={centerCoordinate}>
          {points.map((nextPoint, index, array) => {
            if (index === 0) return null

            return <LineTrack key={index} from={array[index - 1]} to={nextPoint} object={scene} />
          })}
        </FeatureObject>
      })*/}
      {Object.keys(gameState.tracks).map(trackId => {
        const { centerCoordinate, position, rotationY, length, radius } = gameState.tracks[trackId]

        let points = []
        if (radius === 0)
          points = [position, getPosition(position, rotationY, length, 0)]
        else {
          const numberOfPoints = getNumberOfCurvePoints(length, radius)
          for (let i = 0; i <= numberOfPoints; i++)
            points.push(getPosition(position, rotationY, length * i / numberOfPoints, radius))
        }

        return <FeatureObject key={trackId} centerCoordinate={centerCoordinate}>
          {points.map((nextPoint, index, array) => {
            if (index === 0) return null

            return <React.Fragment key={index}>
              <LineTrack
                from={array[index - 1]}
                to={nextPoint}
                object={scene}
                isHovered={0 <= tracksState.hoveredTracks.findIndex(value => value === trackId)}
                isSelected={0 <= tracksState.selectedTracks.findIndex(value => value === trackId)}
              />
              {guiState.menuState === "tracks" && !tracksSubMenuState.isAddingCurve && <>
                <Line
                  points={[array[index - 1], nextPoint]}
                  lineWidth={48}
                  transparent
                  opacity={0}
                  onClick={() => {
                    const index = tracksState.selectedTracks.findIndex(value => value === trackId)

                    if (0 <= index)
                      tracksState.selectedTracks.splice(index, 1)
                    else
                      tracksState.selectedTracks.push(trackId)
                  }}
                  onPointerOver={() => {
                    tracksState.hoveredTracks.push(trackId)
                  }}
                  onPointerOut={() => {
                    const index = tracksState.hoveredTracks.findIndex(value => value === trackId)

                    if (0 <= index)
                      tracksState.hoveredTracks.splice(index, 1)
                  }}
                />
                <Line
                  points={[array[index - 1], nextPoint]}
                  color={
                    tracksState.hoveredTracks.find(value => value === trackId) ? "#ff0" :
                      tracksState.selectedTracks.find(value => value === trackId) ? "#f00" :
                        "#000"
                  }
                />
              </>}
            </React.Fragment>
          })}
        </FeatureObject>
      })}
      {tracksSubMenuState.addingTracks.map(({ centerCoordinate, position, rotationY, length, radius }, trackIndex) => {
        let points = []
        if (radius === 0)
          points = [position, getPosition(position, rotationY, length, 0)]
        else {
          const numberOfPoints = getNumberOfCurvePoints(length, radius)
          for (let i = 0; i <= numberOfPoints; i++)
            points.push(getPosition(position, rotationY, length * i / numberOfPoints, radius))
        }

        return <FeatureObject key={trackIndex} centerCoordinate={centerCoordinate}>
          {points.map((nextPoint, index, array) => {
            if (index === 0) return null

            return <React.Fragment key={index}>
              <Line
                points={[array[index - 1], nextPoint]}
                lineWidth={48}
                transparent
                opacity={0}
                onPointerOver={() => {
                  tracksSubMenuState.hoveredAddingTracks = trackIndex
                }}
                onPointerOut={() => {
                  if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
                    tracksSubMenuState.hoveredAddingTracks = -1
                }}
              />
              <Line
                points={[array[index - 1], nextPoint]}
                color={
                  tracksSubMenuState.hoveredAddingTracks === trackIndex ? "#ff0" :
                    "#000"
                }
              />
            </React.Fragment>
          })}
        </FeatureObject>
      })}
    </>
  )
}
