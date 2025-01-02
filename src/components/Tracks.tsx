import * as React from 'react'
import * as THREE from 'three'
import { useSnapshot } from 'valtio'
import FeatureObject from './FeatureObject'
import { Line } from '@react-three/drei'
import { gameState } from '@/lib/client'
import { Track, TransitionCurve, getHeight, getLength, getPosition, getRotation } from '@/lib/tracks'
import { tracksSubMenuState } from './gui/TracksSubMenu'
import { getRelativePosition } from '@/lib/gis'
import { FROM_CLIENT_SWITCH_TRACK } from '@/lib/game'
import { socket } from './Client'
import GLTFModel from './GLTFModel';
import { ErrorBoundary } from 'react-error-boundary';
import { curveEditMenuState, onClickAddingTrack } from './gui/CurveEditMenu';
import { featureCollectionsTabPanelState } from './gui/FeatureCollectionsTabPanel';
import { getNumberOfCurvePoints, getRotationFromTwoPoints, tracksState } from '@/lib/client/tracks';
import { guiState } from '@/lib/client/gui';
import { trainsTabPanelState } from '@/lib/client/trains';

function RailModel({
  from,
  to,
  rotationX,
  modelPath,
  color,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  rotationX: number;
  modelPath: string;
  color?: string;
}) {
  return <group
    position={from}
    rotation={getRotationFromTwoPoints(from, to, rotationX)}
    scale={[1, 1, from.distanceTo(to)]}
  >
    <ErrorBoundary fallback={null}>
      <React.Suspense fallback={null}>
        <GLTFModel
          modelPath={modelPath}
          meshProps={
            color ? { material: new THREE.MeshBasicMaterial({ color }) }
              : undefined
          }
        />
      </React.Suspense>
    </ErrorBoundary>
  </group>
}

function AddingTracks() {
  useSnapshot(tracksSubMenuState);
  useSnapshot(curveEditMenuState);

  if (!(
    guiState.selectedTab === "tracks" && tracksSubMenuState.isAddingCurve
    || guiState.selectedTab === "featureCollections" && featureCollectionsTabPanelState.straightTracks.length
  ))
    return null;

  return <>
    {curveEditMenuState.addingCurves.map((curve, trackIndex) => {
      if (!curve) return;

      const { centerCoordinate, position, length, radius } = curve;

      let points = []
      if (radius === 0)
        points = [position, getPosition(curve, length)]
      else {
        const numberOfPointsA = getNumberOfCurvePoints(length, radius)
        for (let i = 0; i <= numberOfPointsA; i++)
          points.push(getPosition(curve, length * i / numberOfPointsA))
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
    {curveEditMenuState.addingTransitionsAB.map((curve, trackIndex) => {
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
    {curveEditMenuState.addingTransitionsCD.map((curve, trackIndex) => {
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
  </>;
}

function PointingOnTrack() {
  const { pointingOnTrack } = useSnapshot(tracksState);

  if (!pointingOnTrack) return null;

  return <FeatureObject centerCoordinate={gameState.tracks[pointingOnTrack.trackId].centerCoordinate}>
    <mesh position={getPosition(gameState.tracks[pointingOnTrack.trackId], pointingOnTrack.length)}>
      <sphereGeometry />
      <meshBasicMaterial color={"#f00"} />
    </mesh>
  </FeatureObject>;
}

export default function Tracks() {
  const { selectedTab } = useSnapshot(guiState)
  const tracks = useSnapshot(gameState.tracks)

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
      {Object.keys(tracks).map(trackId => {
        const track = tracks[trackId];

        return selectedTab === "switches"
          ? <TracksOnSwitchMode key={trackId} track={track as Track} trackId={trackId} />
          : <TracksOnOtherMode key={trackId} track={track as Track} trackId={trackId} />;
      })}
      <AddingTracks />
      <PointingOnTrack />
    </>
  )
}

function TracksOnOtherMode({ track, trackId }: { track: Track, trackId: string }) {
  const { isAddingCurve } = useSnapshot(tracksSubMenuState);
  useSnapshot(tracksState);
  useSnapshot(gameState.switches);
  useSnapshot(trainsTabPanelState);

  const { centerCoordinate, position, rotationY, length, radius, beginRotationX, endRotationX, modelPaths, gradients } = track
  let points: THREE.Vector3[] = []
  let rotationXList: number[] = []
  if ((track as TransitionCurve).endPosition === undefined) {
    if (radius === 0) {
      const g = Object.keys(gradients).length
      if (1 < g) {
        const numberOfPoints = Math.ceil(length / 5) // TODO
        for (let i = 0; i <= numberOfPoints; i++)
          points.push(getPosition(track, length * i / numberOfPoints))
      } else if (beginRotationX === endRotationX)
        points = [position, getPosition(track, length)]
      else {
        // 直線でカントが変化する場合
        const numberOfPoints = 2 // TODO
        for (let i = 0; i <= numberOfPoints; i++)
          points.push(getPosition(track, length * i / numberOfPoints))
      }
    } else {
      const numberOfPointsA = getNumberOfCurvePoints(length, radius)
      for (let i = 0; i <= numberOfPointsA; i++)
        points.push(getPosition(track, length * i / numberOfPointsA))
    }
  } else {
    const { transitionCurves, endPosition, curveDirection } = track as TransitionCurve;

    for (let i = 0; i < transitionCurves.length; i++)
      points.push(
        position.clone()
          .add(transitionCurves[i].position.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))
            .add(new THREE.Vector3(0, getHeight(length * i / transitionCurves.length, gradients)))
          ));
    points.push(
      position.clone()
        .add(endPosition.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))
          .add(new THREE.Vector3(0, getHeight(length, gradients)))
        ));
  }

  for (let i = 1; i < points.length; i++)
    //rotationXList.push(beginRotationX + (endRotationX - beginRotationX) * (i - 0.5) / (points.length - 1));
    rotationXList.push(getRotation(track, (i - 0.5) * length / (points.length - 1)).x);

  let color: string | undefined;
  if (isAddingCurve) color = "#888";
  else if (0 <= tracksState.hoveredTracks.findIndex(value => value === trackId)) color = "#ff0";
  else if (0 <= tracksState.selectedTrackIds.findIndex(value => value === trackId)) color = "#f00";
  else if (tracksState.hoveredTracks.length === 1) {
    const hoveredTrack = gameState.tracks[tracksState.hoveredTracks[0]];

    if (hoveredTrack.idOfTrackOrSwitchConnectedFromStart) {
      if (hoveredTrack.connectedFromStartIsTrack) {
        if (trackId === hoveredTrack.idOfTrackOrSwitchConnectedFromStart) color = "#00f";
      } else {
        const trackSwitch = gameState.switches[hoveredTrack.idOfTrackOrSwitchConnectedFromStart];
        if (trackSwitch.connectedTrackIds.includes(trackId)) color = "#00f";
      }
    }

    if (hoveredTrack.idOfTrackOrSwitchConnectedFromEnd) {
      if (hoveredTrack.connectedFromEndIsTrack) {
        if (trackId === hoveredTrack.idOfTrackOrSwitchConnectedFromEnd) color = "#00f";
      } else {
        const trackSwitch = gameState.switches[hoveredTrack.idOfTrackOrSwitchConnectedFromEnd];
        if (trackSwitch.connectedTrackIds.includes(trackId)) color = "#00f";
      }
    }
  }

  return <FeatureObject centerCoordinate={centerCoordinate}>
    {points.map((nextPoint, pointIndex, array) => {
      if (pointIndex === 0) return null

      return <React.Fragment key={pointIndex}>
        {modelPaths.map((modelPath, modelIndex) => <RailModel
          key={modelIndex}
          from={array[pointIndex - 1]}
          to={nextPoint}
          rotationX={rotationXList[pointIndex - 1]}
          modelPath={modelPath}
          color={color}
        />)}
      </React.Fragment>
    })}
    {guiState.selectedTab === "tracks" && <>
      <Line
        points={points}
        lineWidth={48}
        transparent
        opacity={0}
        onClick={() => {
          if (tracksSubMenuState.isAddingCurve) return

          const index = tracksState.selectedTrackIds.findIndex(value => value === trackId)

          if (0 <= index)
            tracksState.selectedTrackIds.splice(index, 1)
          else
            tracksState.selectedTrackIds.push(trackId)
        }}
        onPointerOver={() => {
          if (tracksSubMenuState.isAddingCurve) return

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
        color={color || "#000"}
      />
    </>}
    {guiState.selectedTab === "trains" &&
      (trainsTabPanelState.isAddingTrain || trainsTabPanelState.editingTrainId) &&
      !trainsTabPanelState.pointOnTrack && <>
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
          onPointerOut={() => {
            if (tracksState.pointingOnTrack?.trackId === trackId)
              tracksState.pointingOnTrack = undefined
          }}
          onClick={() => {
            if (tracksState.pointingOnTrack && trackId === tracksState.pointingOnTrack.trackId) {
              trainsTabPanelState.pointOnTrack = tracksState.pointingOnTrack;
              tracksState.pointingOnTrack = undefined;
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
  </FeatureObject>;
}

function TracksOnSwitchMode({ track, trackId }: { track: Track, trackId: string }) {
  useSnapshot(tracksState);
  useSnapshot(gameState.switches);

  const { centerCoordinate, position, rotationY, length, radius, beginRotationX, endRotationX, modelPaths, gradients } = track
  let points: THREE.Vector3[] = []
  let rotationXList: number[] = []
  if ((track as TransitionCurve).endPosition === undefined) {
    if (radius === 0) {
      const g = Object.keys(gradients).length
      if (1 < g) {
        const numberOfPoints = Math.ceil(length / 5) // TODO
        for (let i = 0; i <= numberOfPoints; i++)
          points.push(getPosition(track, length * i / numberOfPoints))
      } else if (beginRotationX === endRotationX)
        points = [position, getPosition(track, length / 2), getPosition(track, length)]
      else {
        // 直線でカントが変化する場合
        const numberOfPoints = 3 // 3 <= numberOfPoints
        for (let i = 0; i <= numberOfPoints; i++)
          points.push(getPosition(track, length * i / numberOfPoints))
      }
    } else {
      const numberOfPointsA = Math.max(2, getNumberOfCurvePoints(length, radius))
      for (let i = 0; i <= numberOfPointsA; i++)
        points.push(getPosition(track, length * i / numberOfPointsA))
    }
  } else {
    const { transitionCurves, endPosition, curveDirection } = track as TransitionCurve;

    for (let i = 0; i < transitionCurves.length; i++)
      points.push(
        position.clone()
          .add(transitionCurves[i].position.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))
            .add(new THREE.Vector3(0, getHeight(length * i / transitionCurves.length, gradients)))
          ));
    points.push(
      position.clone()
        .add(endPosition.clone().multiply(new THREE.Vector3(1, 1, curveDirection ? 1 : -1)).applyEuler(new THREE.Euler(0, rotationY))
          .add(new THREE.Vector3(0, getHeight(length, gradients)))
        ));
  }

  for (let i = 1; i < points.length; i++)
    //rotationXList.push(beginRotationX + (endRotationX - beginRotationX) * (i - 0.5) / (points.length - 1));
    rotationXList.push(getRotation(track, (i - 0.5) * length / (points.length - 1)).x);

  let colorStart: string | undefined;
  let colorEnd: string | undefined;
  if (guiState.selectedTab === "switches") {
    for (const { connectedTrackIds, currentConnected, isConnectedToEnd } of Object.values(gameState.switches)) {
      const connectedIndex = connectedTrackIds.findIndex(value => value === trackId);
      if (currentConnected !== -1 && connectedTrackIds[currentConnected] === trackId) {
        if (isConnectedToEnd[connectedIndex])
          colorEnd = "#0f0";
        else
          colorStart = "#0f0";
        break;
      } else if (0 <= connectedIndex) {
        if (isConnectedToEnd[connectedIndex])
          colorEnd = "#f00";
        else
          colorStart = "#f00";
        break;
      }
    }
  }

  return <FeatureObject centerCoordinate={centerCoordinate}>
    {guiState.selectedTab === "switches" && <>
      <Line
        points={points.slice(0, points.length / 2 + 1)}
        lineWidth={48}
        transparent
        opacity={0}
        onPointerOver={() => {
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
        }}
        onPointerOut={() => {
          if (!tracksState.hoveredSwitch) return;
          const railroadSwitch = gameState.switches[tracksState.hoveredSwitch];
          const index = railroadSwitch.connectedTrackIds.indexOf(trackId);
          if (0 <= index && !railroadSwitch.isConnectedToEnd[index])
            tracksState.hoveredSwitch = "";
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
        points={points.slice(0, points.length / 2 + 1)}
        color={colorStart || "#000"}
      />
      <Line
        points={points.slice(points.length / 2)}
        lineWidth={48}
        transparent
        opacity={0}
        onPointerOver={() => {
          Object.keys(gameState.switches).forEach(switchId => {
            const { connectedTrackIds, isConnectedToEnd } = gameState.switches[switchId];
            for (let i = 0; i < connectedTrackIds.length; i++) {
              if (connectedTrackIds[i] === trackId && isConnectedToEnd[i]) {
                tracksState.hoveredSwitch = switchId;
                break;
              }
            }
          })
        }}
        onPointerOut={() => {
          if (!tracksState.hoveredSwitch) return;
          const railroadSwitch = gameState.switches[tracksState.hoveredSwitch];
          const index = railroadSwitch.connectedTrackIds.indexOf(trackId);
          if (0 <= index && railroadSwitch.isConnectedToEnd[index])
            tracksState.hoveredSwitch = "";
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
        points={points.slice(points.length / 2)}
        color={colorEnd || "#000"}
      />
    </>}
  </FeatureObject>;
}
