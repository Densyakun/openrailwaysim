import * as React from 'react'
import * as THREE from 'three'
import { v4 as uuidv4 } from 'uuid';
import { useSnapshot } from 'valtio'
import { getRotationFromTwoPoints } from '@/lib/projectedLine'
import FeatureObject from './FeatureObject'
import { useFrame } from '@react-three/fiber'
import { Line, useGLTF } from '@react-three/drei'
import { gameState } from '@/lib/client'
import { getLength, getPosition, state as tracksState } from '@/lib/tracks'
import { guiState } from './gui/GUI'
import { onClickAddingTrack, tracksSubMenuState } from './gui/TracksSubMenu'
import { trainsSubMenuState } from './gui/TrainsSubMenu'
import { getRelativePosition } from '@/lib/gis'
import { createTestOneAxleCar } from '@/lib/trainSamples'
import { SerializableTrain } from '@/lib/trains'
import { FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game'
import { socket } from './Client'

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
        const track = gameState.tracks[trackId]
        const { centerCoordinate, position, rotationY, length, radius } = track

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

            return <LineTrack
              key={index}
              from={array[index - 1]}
              to={nextPoint}
              object={scene}
              isHovered={0 <= tracksState.hoveredTracks.findIndex(value => value === trackId)}
              isSelected={0 <= tracksState.selectedTracks.findIndex(value => value === trackId)}
            />
          })}
          {guiState.menuState === "tracks" && !tracksSubMenuState.isAddingCurve && <>
            <Line
              points={points}
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
              points={points}
              color={
                tracksState.hoveredTracks.find(value => value === trackId) ? "#ff0" :
                  tracksState.selectedTracks.find(value => value === trackId) ? "#f00" :
                    "#000"
              }
            />
          </>}
          {guiState.menuState === "trains" && trainsSubMenuState.menuState === "placeAxle" && <>
            <Line
              points={points}
              lineWidth={48}
              transparent
              opacity={0}
              onPointerMove={e => {
                const point = e.intersections[0].point

                tracksState.pointingOnTrack = {
                  trackId,
                  length: Math.min(track.length, Math.max(0, getLength(point.clone().sub(getRelativePosition(track.centerCoordinate)), track))),
                }
              }}
              onClick={() => {
                if (tracksState.pointingOnTrack && trackId === tracksState.pointingOnTrack.trackId) {
                  const train: SerializableTrain = toSerializableProp(
                    ["trains", uuidv4()],
                    createTestOneAxleCar({
                      gameState,
                      trackId,
                      length: tracksState.pointingOnTrack.length,
                      uiMasterControllerOptionId: "0",
                    })
                  );

                  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["trains", train]]));
                }
              }}
            />
            <Line
              points={points}
              color={
                tracksState.pointingOnTrack?.trackId === trackId ? "#ff0" :
                  "#000"
              }
            />
          </>}
        </FeatureObject>
      })}
      {guiState.menuState === "tracks" &&
        tracksSubMenuState.isAddingCurve &&
        tracksSubMenuState.addingTracks.map(({ centerCoordinate, position, rotationY, length, radius }, trackIndex) => {
          let points = []
          if (radius === 0)
            points = [position, getPosition(position, rotationY, length, 0)]
          else {
            const numberOfPoints = getNumberOfCurvePoints(length, radius)
            for (let i = 0; i <= numberOfPoints; i++)
              points.push(getPosition(position, rotationY, length * i / numberOfPoints, radius))
          }

          return <FeatureObject key={trackIndex} centerCoordinate={centerCoordinate}>
            <Line
              points={points}
              lineWidth={48}
              transparent
              opacity={0}
              onClick={() => {
                if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
                  onClickAddingTrack(trackIndex)
              }}
              onPointerOver={() => {
                tracksSubMenuState.hoveredAddingTracks = trackIndex
              }}
              onPointerOut={() => {
                if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
                  tracksSubMenuState.hoveredAddingTracks = -1
              }}
            />
            <Line
              points={points}
              color={
                tracksSubMenuState.hoveredAddingTracks === trackIndex ? "#ff0" :
                  "#000"
              }
            />
          </FeatureObject>
        })}
      {guiState.menuState === "trains" && trainsSubMenuState.menuState === "placeAxle" &&
        tracksState.pointingOnTrack &&
        <FeatureObject centerCoordinate={gameState.tracks[tracksState.pointingOnTrack.trackId].centerCoordinate}>
          <mesh position={getPosition(gameState.tracks[tracksState.pointingOnTrack.trackId].position, gameState.tracks[tracksState.pointingOnTrack.trackId].rotationY, tracksState.pointingOnTrack.length, gameState.tracks[tracksState.pointingOnTrack.trackId].radius)}>
            <sphereGeometry />
            <meshBasicMaterial color={"#f00"} />
          </mesh>
        </FeatureObject>
      }
    </>
  )
}
