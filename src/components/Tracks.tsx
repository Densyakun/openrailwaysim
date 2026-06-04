import * as THREE from 'three'
import { useSnapshot } from 'valtio'
import { Detailed, Line } from '@react-three/drei'
import { Track, TransitionCurve, getCant, getLength, getPosition, getRotation } from '@/lib/tracks'
import { tracksSubMenuState } from './gui/TracksSubMenu'
import { socket } from './Client'
import GLTFModel from './GLTFModel';
import { ErrorBoundary, FallbackProps, useErrorBoundary } from 'react-error-boundary';
import { onClickAddingTrack } from './gui/CurveEditMenu';
import { featureCollectionsTabPanelState } from './gui/FeatureCollectionsTabPanel';
import { getNumberOfCurvePoints, getRotationFromTwoPoints } from "@/lib/client/tracks/index"
import { tracksState } from "@/lib/client/tracks/store"
import { guiState } from '@/lib/client/gui';
import { trainsTabPanelState } from '@/lib/client/trains';
import { diagramsTabPanelState } from '@/lib/client/diagrams'
import { editTracksInDiagramState, onUpdateTrackList, getConnectedTracks } from './gui/EditTracksInDiagramPanel'
import { verticalCurveEditState } from '@/lib/client/verticalCurveEdit'
import { ThreeEvent } from '@react-three/fiber'
import { Fragment, useEffect } from 'react'
import { gltfState } from '@/lib/client/gltf'
import { MessageCode, send } from '@/lib/ws'
import { curveEditMenuState } from '@/lib/client/curveEditMenu'
import { store } from '@/lib/game'

function ErrorFallback({ }: FallbackProps) {
  const { resetBoundary } = useErrorBoundary();

  useEffect(() => {
    // エラーが発生しても、アプリを再起動せずに他のモデルを読み込めるようにするために、エラーをリセットする関数を保管する
    gltfState.errorBoundaryResetFuncList.push(resetBoundary);
  }, []);

  return null;
}

function TrackModel({
  track,
  from,
  to,
  isInclined,
  tilt,
  modelPath,
  minDistance,
  maxDistance,
  isRail = false,
  color,
  overrideGradients,
}: {
  track: Track;
  from: number;
  to: number;
  isInclined: boolean;
  tilt: number;
  modelPath: string;
  minDistance: number;
  maxDistance: number;
  isRail?: boolean;
  color?: string;
  overrideGradients?: { [key: number]: number };
}) {
  useEffect(() => {
    gltfState.errorBoundaryResetFuncList.forEach(func => func());
    gltfState.errorBoundaryResetFuncList.splice(0);
  }, [modelPath]);

  const children = <ErrorBoundary FallbackComponent={ErrorFallback}>
    <Detailed distances={maxDistance === 0 ? [0, minDistance] : [0, minDistance, maxDistance]}>
      <group />
      <group>
        <GLTFModel
          modelPath={modelPath}
          meshProps={
            color ? { material: new THREE.MeshBasicMaterial({ color }) }
              : undefined
          }
        />
      </group>
      <group />
    </Detailed>
  </ErrorBoundary>;

  const fromPos = getPosition(track, from, overrideGradients);
  if (from === to) {
    const rotation = getRotation(track, from);
    rotation.z = -tilt;
    return <group
      position={fromPos}
      rotation={rotation}
      scale={[1, 1, 1]}
    >
      {children}
    </group>;
  }

  const toPos = getPosition(track, to, overrideGradients);
  if (!isInclined) toPos.setY(fromPos.y);
  return <group
    position={fromPos}
    rotation={getRotationFromTwoPoints(fromPos, toPos, tilt)}
    scale={[1, 1, isRail ? fromPos.distanceTo(toPos) : 1]}
  >
    {children}
  </group>;
}

function TrackLine({
  points,
  color,
  onClick,
  onPointerOver,
  onPointerMove,
  onPointerOut,
}: {
  points: THREE.Vector3[];
  color?: THREE.ColorRepresentation;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  return <>
    <Line
      points={points}
      lineWidth={48}
      transparent
      opacity={0}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
    />
    <Line
      points={points}
      color={color}
    />
  </>;
}

function AddingTracks() {
  const { selectedTab } = useSnapshot(guiState);
  const { isAddingCurve, hoveredAddingTracks } = useSnapshot(tracksSubMenuState);
  const { addingCurves, addingTransitionsAB, addingTransitionsCD } = useSnapshot(curveEditMenuState);
  const { straightTracks } = useSnapshot(featureCollectionsTabPanelState);

  if (!(
    selectedTab === "tracks" && isAddingCurve
    || selectedTab === "featureCollections" && straightTracks.length
  ))
    return null;

  return <>
    {addingCurves.map((curve, trackIndex) => {
      if (!curve) return;

      const lengthOfPoints = getLengthOfPoints(curve as Track).lengthOfPoints;
      const points = lengthOfPoints.map(length => getPosition(curve, length));

      return <TrackLine
        key={trackIndex}
        points={points}
        color={
          hoveredAddingTracks === trackIndex ? "#ff0" :
            "#000"
        }
        onPointerMove={() => {
          tracksSubMenuState.hoveredAddingTracks = trackIndex
        }}
        onPointerOut={() => {
          if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
            tracksSubMenuState.hoveredAddingTracks = -1
        }}
        onClick={() => {
          if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
            onClickAddingTrack(trackIndex)
        }}
      />
    })}
    {addingTransitionsAB.map((curve, trackIndex) => {
      if (!curve) return;

      const lengthOfPoints = getLengthOfPoints(curve as TransitionCurve).lengthOfPoints;
      const points = lengthOfPoints.map(length => getPosition(curve, length));

      return <TrackLine
        key={trackIndex}
        points={points}
        color={
          hoveredAddingTracks === trackIndex ? "#ff0" :
            "#f0f"
        }
        onPointerMove={() => {
          tracksSubMenuState.hoveredAddingTracks = trackIndex
        }}
        onPointerOut={() => {
          if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
            tracksSubMenuState.hoveredAddingTracks = -1
        }}
        onClick={() => {
          if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
            onClickAddingTrack(trackIndex)
        }}
      />
    })}
    {addingTransitionsCD.map((curve, trackIndex) => {
      if (!curve) return;

      const lengthOfPoints = getLengthOfPoints(curve as TransitionCurve).lengthOfPoints;
      const points = lengthOfPoints.map(length => getPosition(curve, length));

      return <TrackLine
        key={trackIndex}
        points={points}
        color={
          hoveredAddingTracks === trackIndex ? "#ff0" :
            "#f0f"
        }
        onPointerMove={() => {
          tracksSubMenuState.hoveredAddingTracks = trackIndex
        }}
        onPointerOut={() => {
          if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
            tracksSubMenuState.hoveredAddingTracks = -1
        }}
        onClick={() => {
          if (tracksSubMenuState.hoveredAddingTracks === trackIndex)
            onClickAddingTrack(trackIndex)
        }}
      />
    })}
  </>;
}

function PointingOnTrack() {
  const { pointingOnTrack } = useSnapshot(tracksState);
  const { tracks } = useSnapshot(store.data);

  if (!pointingOnTrack) return null;

  return <PointingOnTrackMesh position={getPosition(tracks[pointingOnTrack.trackId], pointingOnTrack.length)} />;
}

function PointingOnTrackDiagramSectionRoute() {
  const { tracks } = useSnapshot(store.data);
  const { sections, selectingDiagramSectionIndex, selectingRouteIndex } = useSnapshot(diagramsTabPanelState);

  if (!sections || selectingDiagramSectionIndex < 0 || selectingRouteIndex < 0) return null;

  const trackRoute = sections[selectingDiagramSectionIndex].routes[selectingRouteIndex];
  if (!trackRoute.trackIds.length) return null;

  return <PointingOnTrackMesh position={getPosition(tracks[trackRoute.trackIds[0]], trackRoute.stopOffset)} />;
}

function PointingOnTrackMesh({ position }: { position: THREE.Vector3 }) {
  return <mesh position={position}>
    <sphereGeometry />
    <meshBasicMaterial color={"#f00"} />
  </mesh>;
}

export default function Tracks() {
  // サーバー接続時にセーブデータを即時反映するために、分割代入でデータを参照する
  const { tracks } = useSnapshot(store.data);
  const { selectedTab } = useSnapshot(guiState);
  const { tracksIsEditing } = useSnapshot(tracksSubMenuState);

  return <>
    {Object.keys(tracks).map(trackId => {
      const track = tracks[trackId];

      return selectedTab === "switches"
        ? <TracksOnSwitchMode key={trackId} track={track as Track} trackId={trackId} />
        : <TracksOnTrackMode key={trackId} track={track as Track} trackId={trackId} />;
    })}
    <AddingTracks />
    {!tracksIsEditing && <PointingOnTrack />}
    <PointingOnTrackDiagramSectionRoute />
  </>;
}

function TracksOnTrackMode({ track, trackId }: { track: Track, trackId: string }) {
  const { selectedTab } = useSnapshot(guiState);
  const { editingTrainFormatId, isAddingTrainFormat, isAddingTrain, pointOnTrack: pointOnTrackOfTrainsTab } = useSnapshot(trainsTabPanelState);
  const { editingSectionsInDiagramId, selectingDiagramSectionIndex, sections, selectingRouteIndex, tracksIsEditing: diagramTracksIsEditing } = useSnapshot(diagramsTabPanelState);
  const { editingTrackId, beginCant, endCant, tracksIsEditing, editingTrackIds } = useSnapshot(tracksSubMenuState);
  const { gradientPoints, trackIds: verticalCurveTrackIds, isEditing: isEditingVerticalCurve } = useSnapshot(verticalCurveEditState, { sync: true });
  const switches = useSnapshot(store.data.switches);

  track = { ...track };
  if (editingTrackId) {
    if (trackId === editingTrackId) {
      if (!isNaN(parseFloat(beginCant)))
        track.beginCant = parseFloat(beginCant);
      if (!isNaN(parseFloat(endCant)))
        track.endCant = parseFloat(endCant);
    }
    if (track.idOfTrackOrSwitchConnectedFromStart) {
      if (track.connectedFromStartIsTrack) {
        if (track.idOfTrackOrSwitchConnectedFromStart === editingTrackId) {
          if (track.connectedFromStartIsToEnd) {
            if (!isNaN(parseFloat(endCant)))
              track.beginCant = parseFloat(endCant);
          } else if (!isNaN(parseFloat(beginCant)))
            track.beginCant = -parseFloat(beginCant);
        }
      } else {
        const railroadSwitch = switches[track.idOfTrackOrSwitchConnectedFromStart];
        const connectedTrackId = railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected];
        if (connectedTrackId === editingTrackId) {
          if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
            if (!isNaN(parseFloat(endCant)))
              track.beginCant = parseFloat(endCant);
          } else if (!isNaN(parseFloat(beginCant)))
            track.beginCant = -parseFloat(beginCant);
        }
      }
    }
    if (track.idOfTrackOrSwitchConnectedFromEnd) {
      if (track.connectedFromEndIsTrack) {
        if (track.idOfTrackOrSwitchConnectedFromEnd === editingTrackId) {
          if (track.connectedFromEndIsToEnd) {
            if (!isNaN(parseFloat(endCant)))
              track.endCant = -parseFloat(endCant);
          } else if (!isNaN(parseFloat(beginCant)))
            track.endCant = parseFloat(beginCant);
        }
      } else {
        const railroadSwitch = switches[track.idOfTrackOrSwitchConnectedFromEnd];
        const connectedTrackId = railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected];
        if (connectedTrackId === editingTrackId) {
          if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
            if (!isNaN(parseFloat(endCant)))
              track.endCant = -parseFloat(endCant);
          } else if (!isNaN(parseFloat(beginCant)))
            track.endCant = parseFloat(beginCant);
        }
      }
    }
  }

  const { length, trackModels } = track;
  const { lengthOfPoints, previewGradients } = getLengthOfPoints(track, false, trackId, gradientPoints, verticalCurveTrackIds, isEditingVerticalCurve, editingTrackIds);
  const points = lengthOfPoints.map(length => getPosition(track, length, previewGradients));

  let cantList: number[] = [];
  for (let i = 1; i < lengthOfPoints.length; i++)
    cantList.push(getCant(track, (i - 0.5) * length / (lengthOfPoints.length - 1)));

  const color = useTrackColorOnTrackMode(trackId);

  // イベントの条件
  const T = selectedTab === "trains" // 名前変更
    && (isAddingTrainFormat || editingTrainFormatId || isAddingTrain)
    && !pointOnTrackOfTrainsTab;
  const D = selectedTab === "diagrams"
    && editingSectionsInDiagramId
    && 0 <= selectingDiagramSectionIndex;
  const eventIsEnable =
    selectedTab === "tracks"
    || T
    || D
    || tracksIsEditing;
  const isSelectable =
    selectedTab === "tracks" && !tracksSubMenuState.isAddingCurve && !tracksIsEditing;
  let isHoverable = isSelectable;
  let isPointableOnTrack = T;

  if (tracksIsEditing) {
    if (!editingTrackIds.length) {
      isHoverable = true;
      isPointableOnTrack = true;
    } else {
      const lastTrackId = editingTrackIds[editingTrackIds.length - 1];
      const connectedTracks = getConnectedTracks(store.data.tracks[lastTrackId], [...editingTrackIds]);
      if (connectedTracks.includes(trackId)) {
        isHoverable = true;
        isPointableOnTrack = true;
      }
    }
  }

  if (D && sections && 0 <= selectingRouteIndex) {
    const trackRoute = sections[selectingDiagramSectionIndex].routes[selectingRouteIndex];
    if (diagramTracksIsEditing) {
      if (!trackRoute.trackIds.length) {
        isHoverable = true;
        isPointableOnTrack = true;
      }
    } else if (trackId === trackRoute.trackIds[trackRoute.trackIds.length - 1])
      isPointableOnTrack = true;
  }

  return <>
    {points.map((_, pointIndex) => {
      if (pointIndex === 0) return null;

      return <Fragment key={pointIndex}>
        {trackModels.map((trackModel, modelIndex) => {
          // レール用の3Dモデル
          if (
            trackModel.interval !== 0
            || lengthOfPoints[pointIndex] < trackModel.start
            || trackModel.end !== -1 && trackModel.end < lengthOfPoints[pointIndex - 1]
          ) return;

          return <TrackModel
            key={modelIndex}
            track={track}
            from={Math.max(lengthOfPoints[pointIndex - 1], trackModel.start)}
            to={Math.min(lengthOfPoints[pointIndex], trackModel.end === -1 ? track.length : trackModel.end)}
            isInclined={trackModel.isInclined}
            tilt={trackModel.isTilting ? cantList[pointIndex - 1] : 0}
            modelPath={trackModel.modelPath}
            minDistance={trackModel.minDistance}
            maxDistance={trackModel.maxDistance}
            overrideGradients={previewGradients}
            isRail={true}
            color={color}
          />;
        })}
      </Fragment>;
    })}
    {trackModels.map((trackModel, modelIndex) => {
      // 非連続設置の3Dモデル
      if (trackModel.start === trackModel.end)
        return <TrackModel
          key={modelIndex}
          track={track}
          from={trackModel.start}
          to={trackModel.start + trackModel.span}
          isInclined={trackModel.isInclined}
          tilt={trackModel.isTilting ? getCant(track, trackModel.start) : 0}
          modelPath={trackModel.modelPath}
          minDistance={trackModel.minDistance}
          maxDistance={trackModel.maxDistance}
          color={color}
          overrideGradients={previewGradients}
        />;

      // 非レール用の3Dモデル
      if (trackModel.interval === 0) return;

      const length = (trackModel.end === -1 ? track.length : trackModel.end) - trackModel.start;
      const modelCount = Math.round(length / trackModel.interval);

      return <Fragment key={modelIndex}>
        {[...Array(modelCount)].map((_, index) =>
          <TrackModel
            key={index}
            track={track}
            from={trackModel.start + length * index / modelCount}
            to={
              trackModel.span === 0
                ? trackModel.start + length * index / modelCount
                : trackModel.span === -1
                  ? trackModel.start + length * (index + 1) / modelCount
                  : trackModel.start + length * index / modelCount + trackModel.span
            }
            isInclined={trackModel.isInclined}
            tilt={trackModel.isTilting ? getCant(track, length * (index - 0.5) / modelCount) : 0}
            modelPath={trackModel.modelPath}
            minDistance={trackModel.minDistance}
            maxDistance={trackModel.maxDistance}
            color={color}
            overrideGradients={previewGradients}
          />
        )}
      </Fragment>;
    })}
    {eventIsEnable && <TrackLine
      points={points}
      color={color || "#000"}
      onPointerOver={() => {
        if (!isHoverable) return;

        tracksState.hoveredTracks.push(trackId);
      }}
      onPointerMove={e => {
        if (!isPointableOnTrack) return;

        tracksState.pointingOnTrack = {
          trackId,
          length: Math.min(track.length, Math.max(0, getLength(e.intersections[0].point, track))),
        };
      }}
      onPointerOut={() => {
        const index = tracksState.hoveredTracks.findIndex(value => value === trackId);

        if (0 <= index)
          tracksState.hoveredTracks.splice(index, 1);

        if (tracksState.pointingOnTrack?.trackId === trackId)
          tracksState.pointingOnTrack = undefined;
      }}
      onClick={() => {
        if (isSelectable) {
          const index = tracksState.selectedTrackIds.findIndex(value => value === trackId);

          if (0 <= index)
            tracksState.selectedTrackIds.splice(index, 1);
          else
            tracksState.selectedTrackIds.push(trackId);
        }

        if (T) {
          if (!tracksState.pointingOnTrack || trackId !== tracksState.pointingOnTrack.trackId) return;

          trainsTabPanelState.pointOnTrack = tracksState.pointingOnTrack;
          tracksState.pointingOnTrack = undefined;
        }

        if (tracksIsEditing) {
          if (!tracksState.pointingOnTrack || trackId !== tracksState.pointingOnTrack.trackId) return;

          if (!editingTrackIds.length) {
            tracksSubMenuState.editingTrackIds = [trackId];
          } else {
            const lastTrackId = editingTrackIds[editingTrackIds.length - 1];
            const connectedTracks = getConnectedTracks(store.data.tracks[lastTrackId], [...editingTrackIds]);
            if (connectedTracks.includes(trackId)) {
              tracksSubMenuState.editingTrackIds = [...editingTrackIds, trackId];
            }
          }
          // Update next track list
          if (editingTrackIds.length) {
            const lastTrackId = editingTrackIds[editingTrackIds.length - 1];
            const track = store.data.tracks[lastTrackId];
            editTracksInDiagramState.nextTrackIds = getConnectedTracks(track, [...editingTrackIds]);
            if (editTracksInDiagramState.focusedNextTrackIndex === -1 || editTracksInDiagramState.nextTrackIds.length <= editTracksInDiagramState.focusedNextTrackIndex)
              editTracksInDiagramState.focusedNextTrackIndex = 0;
          }
          return;
        }

        if (D) {
          if (!diagramsTabPanelState.sections || diagramsTabPanelState.selectingRouteIndex < 0) return;

          const trackRoute = diagramsTabPanelState.sections[diagramsTabPanelState.selectingDiagramSectionIndex].routes[diagramsTabPanelState.selectingRouteIndex];
          if (diagramsTabPanelState.tracksIsEditing) {
            if (!tracksState.pointingOnTrack || trackId !== tracksState.pointingOnTrack.trackId) return;

            trackRoute.trackIds.push(tracksState.pointingOnTrack.trackId);
            trackRoute.stopOffset = tracksState.pointingOnTrack.length;
            onUpdateTrackList();
            return;
          }

          if (
            !tracksState.pointingOnTrack
            || trackId !== tracksState.pointingOnTrack.trackId
            || trackId !== trackRoute.trackIds[trackRoute.trackIds.length - 1]
          ) return;
          trackRoute.stopOffset = tracksState.pointingOnTrack.length;
        }
      }}
    />}
  </>;
}

function TracksOnSwitchMode({ track, trackId }: { track: Track, trackId: string }) {
  const { gradientPoints, trackIds: verticalCurveTrackIds, isEditing: isEditingVerticalCurve } = useSnapshot(verticalCurveEditState, { sync: true });
  const { switches } = useSnapshot(store.data);

  const { lengthOfPoints, previewGradients } = getLengthOfPoints(track, true, trackId, gradientPoints, verticalCurveTrackIds, isEditingVerticalCurve, []);
  const points = lengthOfPoints.map(length => getPosition(track, length, previewGradients));

  let colorStart: string | undefined;
  let colorEnd: string | undefined;
  for (const { connectedTrackIds, currentConnected, isConnectedToEnd } of Object.values(switches)) {
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

  return <>
    <TrackLine
      points={points.slice(0, points.length / 2 + 1)}
      color={colorStart || "#000"}
      onPointerOver={() => {
        Object.keys(switches).forEach(switchId => {
          const { connectedTrackIds, isConnectedToEnd } = switches[switchId];
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
        const railroadSwitch = switches[tracksState.hoveredSwitch];
        const index = railroadSwitch.connectedTrackIds.indexOf(trackId);
        if (0 <= index && !railroadSwitch.isConnectedToEnd[index])
          tracksState.hoveredSwitch = "";
      }}
      onClick={() => {
        if (tracksState.hoveredSwitch) {
          const railroadSwitch = switches[tracksState.hoveredSwitch];

          let newCurrentConnected = railroadSwitch.currentConnected + 1;
          if (railroadSwitch.connectedTrackIds.length <= newCurrentConnected) newCurrentConnected = -1;

          send(socket, MessageCode.FROM_CLIENT_SWITCH_TRACK, [tracksState.hoveredSwitch, newCurrentConnected]);
        }
      }}
    />
    <TrackLine
      points={points.slice(points.length / 2)}
      color={colorEnd || "#000"}
      onPointerOver={() => {
        Object.keys(switches).forEach(switchId => {
          const { connectedTrackIds, isConnectedToEnd } = switches[switchId];
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
        const railroadSwitch = switches[tracksState.hoveredSwitch];
        const index = railroadSwitch.connectedTrackIds.indexOf(trackId);
        if (0 <= index && railroadSwitch.isConnectedToEnd[index])
          tracksState.hoveredSwitch = "";
      }}
      onClick={() => {
        if (tracksState.hoveredSwitch) {
          const railroadSwitch = switches[tracksState.hoveredSwitch];

          let newCurrentConnected = railroadSwitch.currentConnected + 1;
          if (railroadSwitch.connectedTrackIds.length <= newCurrentConnected) newCurrentConnected = -1;

          send(socket, MessageCode.FROM_CLIENT_SWITCH_TRACK, [tracksState.hoveredSwitch, newCurrentConnected]);
        }
      }}
    />
  </>;
}

function getLengthOfPoints(track: Track, isSwitchMode = false, trackId?: string, previewGradientPoints?: readonly { position: string; gradient: string }[], verticalCurveTrackIds?: readonly string[], isEditingVerticalCurve?: boolean, editingTrackIds?: readonly string[]): { lengthOfPoints: number[], previewGradients: { [key: number]: number } } {
  const { length, radius, beginCant, endCant, gradients } = track;
  
  // If editing vertical curve, use gradientPoints from state for preview
  let previewGradients = gradients;
  if (trackId && previewGradientPoints && verticalCurveTrackIds && isEditingVerticalCurve && editingTrackIds) {
    if (isEditingVerticalCurve && editingTrackIds.includes(trackId) && verticalCurveTrackIds.includes(trackId)) {
      // Sort gradient points by position
      const sortedPoints = previewGradientPoints
        .map(p => ({ position: parseFloat(p.position), gradient: parseFloat(p.gradient) }))
        .filter(p => !isNaN(p.position) && !isNaN(p.gradient))
        .sort((a, b) => a.position - b.position);
      
      // Calculate total length and track lengths
      let totalLength = 0;
      const trackLengths: number[] = [];
      for (const tid of verticalCurveTrackIds) {
        const t = store.data.tracks[tid];
        if (t) {
          trackLengths.push(t.length);
          totalLength += t.length;
        }
      }
      
      // Find the index of current track
      const trackIndex = verticalCurveTrackIds.indexOf(trackId);
      if (trackIndex !== -1) {
        const trackLength = trackLengths[trackIndex];
        let currentLength = 0;
        for (let i = 0; i < trackIndex; i++) {
          currentLength += trackLengths[i];
        }
        const trackStart = currentLength;
        const trackEnd = currentLength + trackLength;
        
        // Find gradient points that fall within this track
        previewGradients = {};
        for (const point of sortedPoints) {
          if (point.position >= trackStart && point.position <= trackEnd) {
            const relativePosition = point.position - trackStart;
            previewGradients[relativePosition] = point.gradient;
          }
        }
        
        // Ensure we have at least the start and end points
        if (Object.keys(previewGradients).length === 0) {
          // Use the gradient from the nearest point
          const startGradient = getGradientAtPosition(sortedPoints, trackStart);
          previewGradients[0] = startGradient;
          previewGradients[trackLength] = startGradient;
        } else {
          // Ensure start point exists
          if (!previewGradients[0]) {
            previewGradients[0] = getGradientAtPosition(sortedPoints, trackStart);
          }
          // Ensure end point exists
          if (!previewGradients[trackLength]) {
            previewGradients[trackLength] = getGradientAtPosition(sortedPoints, trackEnd);
          }
        }
      }
    }
  }

  let lengthOfPoints: number[] = [];
  if ((track as TransitionCurve).endPosition === undefined) {
    if (radius === 0) {
      const g = Object.keys(previewGradients).length;
      if (1 < g) {
        const numberOfPoints = Math.ceil(length / 5); // TODO
        for (let i = 0; i <= numberOfPoints; i++)
          lengthOfPoints.push(length * i / numberOfPoints);
      } else if (beginCant === endCant)
        lengthOfPoints = isSwitchMode ? [0, length / 2, length] : [0, length];
      else {
        // 直線でカントが変化する場合
        const numberOfPoints = isSwitchMode ? 3 : 2;
        for (let i = 0; i <= numberOfPoints; i++)
          lengthOfPoints.push(length * i / numberOfPoints);
      }
    } else {
      const numberOfPointsA = getNumberOfCurvePoints(length, radius);
      for (let i = 0; i <= numberOfPointsA; i++)
        lengthOfPoints.push(length * i / numberOfPointsA);
    }
  } else {
    const { transitionCurves } = track as TransitionCurve;

    for (let i = 0; i < transitionCurves.length; i++)
      lengthOfPoints.push(length * i / transitionCurves.length);
    lengthOfPoints.push(length);
  }

  return { lengthOfPoints, previewGradients };
}

function getGradientAtPosition(points: { position: number; gradient: number }[], position: number): number {
  if (points.length === 0) return 0;
  
  // Find the point at or before the position
  let beforePoint = points[0];
  let afterPoint = points[points.length - 1];
  
  for (const point of points) {
    if (point.position <= position) {
      beforePoint = point;
    }
    if (point.position >= position) {
      afterPoint = point;
      break;
    }
  }
  
  // If position is before the first point
  if (position < points[0].position) {
    return points[0].gradient;
  }
  
  // If position is after the last point
  if (position > points[points.length - 1].position) {
    return points[points.length - 1].gradient;
  }
  
  // Interpolate between before and after points
  if (beforePoint.position === afterPoint.position) {
    return beforePoint.gradient;
  }
  
  const t = (position - beforePoint.position) / (afterPoint.position - beforePoint.position);
  return beforePoint.gradient + t * (afterPoint.gradient - beforePoint.gradient);
}

function useTrackColorOnTrackMode(trackId: string) {
  const { isAddingCurve, isEditingModels, tracksIsEditing, editingTrackIds } = useSnapshot(tracksSubMenuState);
  const { selectedTab } = useSnapshot(guiState);
  const { hoveredTracks, selectedTrackIds, pointingOnTrack } = useSnapshot(tracksState);
  const { sections, selectingDiagramSectionIndex, selectingRouteIndex, tracksIsEditing: diagramTracksIsEditing } = useSnapshot(diagramsTabPanelState);
  const { focusedNextTrackIndex, nextTrackIds } = useSnapshot(editTracksInDiagramState);
  const { tracks } = useSnapshot(store.data);
  const { switches } = useSnapshot(store.data);

  if (isAddingCurve) return "#888";

  if (tracksIsEditing) {
    if (editingTrackIds.includes(trackId)) return "#f0f";

    if (nextTrackIds.length) {
      if (0 <= focusedNextTrackIndex
        && trackId === nextTrackIds[focusedNextTrackIndex])
        return "#f00";
      else if (nextTrackIds.includes(trackId))
        return "#ff0";
    }
  }

  if (
    0 <= hoveredTracks.findIndex(value => value === trackId)
    || pointingOnTrack?.trackId === trackId
  )
    return "#ff0";

  if (selectedTab === "tracks") {
    if (isEditingModels) return;

    if (tracksIsEditing) return;

    if (0 <= selectedTrackIds.findIndex(value => value === trackId)) return "#f00";

    if (hoveredTracks.length === 1) {
      const hoveredTrack = tracks[hoveredTracks[0]];

      if (hoveredTrack.idOfTrackOrSwitchConnectedFromStart) {
        if (hoveredTrack.connectedFromStartIsTrack) {
          if (trackId === hoveredTrack.idOfTrackOrSwitchConnectedFromStart) return "#00f";
        } else {
          const trackSwitch = switches[hoveredTrack.idOfTrackOrSwitchConnectedFromStart];
          if (trackSwitch.connectedTrackIds.includes(trackId)) return "#00f";
        }
      }

      if (hoveredTrack.idOfTrackOrSwitchConnectedFromEnd) {
        if (hoveredTrack.connectedFromEndIsTrack) {
          if (trackId === hoveredTrack.idOfTrackOrSwitchConnectedFromEnd) return "#00f";
        } else {
          const trackSwitch = switches[hoveredTrack.idOfTrackOrSwitchConnectedFromEnd];
          if (trackSwitch.connectedTrackIds.includes(trackId)) return "#00f";
        }
      }
    }
  } else if (sections.length) {
    const routes = sections[selectingDiagramSectionIndex].routes;

    for (let i = 0; i < routes.length; i++) {
      if (selectingRouteIndex < 0 || i === selectingRouteIndex) {
        const trackRoute = routes[i];

        if (trackRoute.trackIds.includes(trackId)) return "#f0f";

        if (diagramTracksIsEditing) {
          if (nextTrackIds.length) {
            if (0 <= focusedNextTrackIndex
              && trackId === nextTrackIds[focusedNextTrackIndex])
              return "#f00";
            else if (nextTrackIds.includes(trackId))
              return "#ff0";
          }
        } else if (trackId === trackRoute.trackIds[trackRoute.trackIds.length - 1])
          return "#f00";
      }
    }
  }
}
