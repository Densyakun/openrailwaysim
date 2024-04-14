import * as React from 'react'
import * as THREE from 'three'
import { v4 as uuidv4 } from 'uuid';
import { useSnapshot } from 'valtio'
import FeatureObject from './FeatureObject'
import { useFrame } from '@react-three/fiber'
import { Line, useGLTF } from '@react-three/drei'
import { gameState } from '@/lib/client'
import { TransitionCurve, getLength, getPosition, getRotation, state as tracksState } from '@/lib/tracks'
import { guiState } from './gui/GUI'
import { onClickAddingTrack, tracksSubMenuState } from './gui/TracksSubMenu'
import { trainsSubMenuState } from './gui/TrainsSubMenu'
import { getRelativePosition } from '@/lib/gis'
import { createTestOneAxleCar } from '@/lib/trainSamples'
import { SerializableTrain } from '@/lib/trains'
import { FROM_CLIENT_SET_OBJECT, FROM_CLIENT_SWITCH_TRACK, toSerializableProp } from '@/lib/game'
import { socket } from './Client'

export function getNumberOfCurvePoints(length: number, radius: number) {
  const radius_ = Math.abs(radius)
  const l = Math.acos((radius_ - 0.1) / radius_) * 2 * radius_
  return Math.max(3, Math.ceil(length / l))
}

export function getRotationFromTwoPoints(point: THREE.Vector3, nextPoint: THREE.Vector3, rotationX: number) {
  const euler = new THREE.Euler(0, 0, 0, 'XZY').setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      nextPoint.clone().sub(point).normalize()
    ), 'YXZ'
  )
  euler.z = -rotationX
  return euler
}

function LineTrack({
  from,
  to,
  rotationX,
  object,
  color,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  rotationX: number;
  object: THREE.Group;
  color?: string;
}) {
  const groupRef = React.useRef<THREE.Group>(null)

  useFrame(() => {
    const rotation = getRotationFromTwoPoints(from, to, rotationX)

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
        material={color ? new THREE.MeshBasicMaterial({ color }) :
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

        const { centerCoordinate, position, rotationY, length, radius, beginRotationX, endRotationX } = track
        let points: THREE.Vector3[] = []
        let rotationXList: number[] = []
        if ((track as TransitionCurve).endPosition === undefined) {
          if (radius === 0) {
            if (beginRotationX === endRotationX)
              points = [position, getPosition(track, length)]
            else {
              // 直線でカントが変化する場合
              const numberOfPoints = 2 // TODO
              for (let i = 0; i <= numberOfPoints; i++)
                points.push(getPosition(track, length * i / numberOfPoints))
            }
          } else {
            const numberOfPoints = getNumberOfCurvePoints(length, radius)
            for (let i = 0; i <= numberOfPoints; i++)
              points.push(getPosition(track, length * i / numberOfPoints))
          }
        } else {
          const { transitionCurves, endPosition, curveDirection } = track as TransitionCurve;

          for (let i = 0; i < transitionCurves.length; i++)
            points.push(position.clone().add(transitionCurves[i].position.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))));
          points.push(position.clone().add(endPosition.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))));
        }

        for (let i = 1; i < points.length; i++)
          //rotationXList.push(beginRotationX + (endRotationX - beginRotationX) * (i - 0.5) / (points.length - 1))
          rotationXList.push(getRotation(track, (i - 0.5) * length / (points.length - 1)).x)

        return <FeatureObject key={trackId} centerCoordinate={centerCoordinate}>
          {points.map((nextPoint, index, array) => {
            if (index === 0) return null

            let color: string | undefined;
            if (guiState.menuState === "switches") {
              if (tracksState.hoveredSwitch) {
                const { connectedTrackIds, currentConnected } = gameState.switches[tracksState.hoveredSwitch];
                const connectedIndex = connectedTrackIds.findIndex(value => value === trackId);
                if (currentConnected !== -1 && connectedTrackIds[currentConnected] === trackId)
                  color = "#f00";
                else if (0 <= connectedIndex)
                  color = "#ff0";
              }
            }
            else if (0 <= tracksState.hoveredTracks.findIndex(value => value === trackId)) color = "#ff0";
            else if (0 <= tracksState.selectedTrackIds.findIndex(value => value === trackId)) color = "#f00";

            return <LineTrack
              key={index}
              from={array[index - 1]}
              to={nextPoint}
              rotationX={rotationXList[index - 1]}
              object={scene}
              color={color}
            />
          })}
          {guiState.menuState === "tracks" && !tracksSubMenuState.isAddingCurve && <>
            <Line
              points={points}
              lineWidth={48}
              transparent
              opacity={0}
              onClick={() => {
                const index = tracksState.selectedTrackIds.findIndex(value => value === trackId)

                if (0 <= index)
                  tracksState.selectedTrackIds.splice(index, 1)
                else
                  tracksState.selectedTrackIds.push(trackId)
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
                  tracksState.selectedTrackIds.find(value => value === trackId) ? "#f00" :
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
          {guiState.menuState === "switches" && <>
            <Line
              points={points}
              lineWidth={48}
              transparent
              opacity={0}
              onPointerMove={e => {
                const point = e.intersections[0].point

                const pointingOnTrack = {
                  trackId,
                  length: Math.min(length, Math.max(0, getLength(point.clone().sub(getRelativePosition(centerCoordinate)), track))),
                }

                // 始点か終点のカーソルに近い側の分岐器を求める
                if (Math.round(pointingOnTrack.length / length) === 0) {
                  Object.keys(gameState.switches).forEach(switchId => {
                    const { connectedTrackIds, isConnectedToEnd } = gameState.switches[switchId];
                    for (let i = 0; i < connectedTrackIds.length; i++) {
                      if (connectedTrackIds[i] === trackId && !isConnectedToEnd[i]) {
                        // 分岐器が見つかったとき
                        tracksState.hoveredSwitch = switchId;
                        break;
                      }
                    }
                  })
                } else {
                  Object.keys(gameState.switches).forEach(switchId => {
                    const { connectedTrackIds, isConnectedToEnd } = gameState.switches[switchId];
                    for (let i = 0; i < connectedTrackIds.length; i++) {
                      if (connectedTrackIds[i] === trackId && isConnectedToEnd[i]) {
                        tracksState.hoveredSwitch = switchId;
                        break;
                      }
                    }
                  })
                }
              }}
              onClick={() => {
                if (tracksState.hoveredSwitch) {
                  const railroadSwitch = gameState.switches[tracksState.hoveredSwitch];

                  let newCurrentConnected = railroadSwitch.currentConnected + 1;
                  if (railroadSwitch.connectedTrackIds.length <= newCurrentConnected) newCurrentConnected = -1;

                  socket.send(JSON.stringify([FROM_CLIENT_SWITCH_TRACK, [tracksState.hoveredSwitch, newCurrentConnected]]));
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
      {guiState.menuState === "tracks" && tracksSubMenuState.isAddingCurve &&
        <>
          {tracksSubMenuState.addingCurves.map((curve, trackIndex) => {
            if (!curve) return;

            const { centerCoordinate, position, length, radius } = curve;

            let points = []
            if (radius === 0)
              points = [position, getPosition(curve, length)]
            else {
              const numberOfPoints = getNumberOfCurvePoints(length, radius)
              for (let i = 0; i <= numberOfPoints; i++)
                points.push(getPosition(curve, length * i / numberOfPoints))
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
          {tracksSubMenuState.addingTransitions.map((curve, trackIndex) => {
            if (!curve) return;

            const { centerCoordinate, position, rotationY, transitionCurves, endPosition, curveDirection } = curve;

            let points = [];
            for (let i = 0; i < transitionCurves.length; i++)
              points.push(position.clone().add(transitionCurves[i].position.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))));
            points.push(position.clone().add(endPosition.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))));

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
                    "#f0f"
                }
              />
            </FeatureObject>
          })}
          {tracksSubMenuState.addingTransitions1.map((curve, trackIndex) => {
            if (!curve) return;

            const { centerCoordinate, position, rotationY, transitionCurves, endPosition, curveDirection } = curve;

            let points = [];
            for (let i = 0; i < transitionCurves.length; i++)
              points.push(position.clone().add(transitionCurves[i].position.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))));
            points.push(position.clone().add(endPosition.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))));

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
                    "#f0f"
                }
              />
            </FeatureObject>
          })}
        </>
      }
      {
        guiState.menuState === "trains" && trainsSubMenuState.menuState === "placeAxle" &&
        tracksState.pointingOnTrack &&
        <FeatureObject centerCoordinate={gameState.tracks[tracksState.pointingOnTrack.trackId].centerCoordinate}>
          <mesh position={getPosition(gameState.tracks[tracksState.pointingOnTrack.trackId], tracksState.pointingOnTrack.length)}>
            <sphereGeometry />
            <meshBasicMaterial color={"#f00"} />
          </mesh>
        </FeatureObject>
      }
    </>
  )
}
