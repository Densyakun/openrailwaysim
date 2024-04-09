import { Position } from '@turf/helpers';
import * as THREE from 'three'
import { GameStateType, IdentifiedRecord } from './game';
import { proxy } from 'valtio';

export type Track = {
  centerCoordinate: Position;
  position: THREE.Vector3;
  rotationY: number;
  length: number;
  radius: number;
  idOfTrackOrSwitchConnectedFromStart: string;
  idOfTrackOrSwitchConnectedFromEnd: string;
  connectedFromStartIsTrack: boolean;
  connectedFromEndIsTrack: boolean;
  connectedFromStartIsToEnd: boolean;
  connectedFromEndIsToEnd: boolean;
};

export type SerializableTrack = IdentifiedRecord & {
  centerCoordinate: Position;
  position: THREE.Vector3Tuple;
  rotationY: number;
  length: number;
  radius: number;
  idOfTrackOrSwitchConnectedFromStart: string;
  idOfTrackOrSwitchConnectedFromEnd: string;
  connectedFromStartIsTrack: boolean;
  connectedFromEndIsTrack: boolean;
  connectedFromStartIsToEnd: boolean;
  connectedFromEndIsToEnd: boolean;
};

export type PointOnTrack = {
  trackId: string;
  length: number;
}

export const TRANSITION_STEP = 1; // 緩和曲線の座標を計算する距離の間隔

export type TransitionCurveSegment = {
  position: THREE.Vector3;
  rotationY: number;
  curvature: number;
};

export type SerializableTransitionCurveSegment = {
  position: THREE.Vector3Tuple;
  rotationY: number;
  curvature: number;
};

export type TransitionCurveData = {
  beginCurvature: number;
  endCurvature: number;
  endPosition: THREE.Vector3;
  endRotationY: number;
  transitionCurves: TransitionCurveSegment[];
};

export type SerializableTransitionCurveData = {
  beginCurvature: number;
  endCurvature: number;
  endPosition: THREE.Vector3Tuple;
  endRotationY: number;
  transitionCurves: SerializableTransitionCurveSegment[];
};

export type TransitionCurve = Track & TransitionCurveData & {
  // 計算した緩和曲線の値を再利用するためのプロパティ
  curveDirection: boolean;
};

export type SerializableTransitionCurve = SerializableTrack & SerializableTransitionCurveData & {
  // 計算した緩和曲線の値を再利用するためのプロパティ
  curveDirection: boolean;
};

/**
 * @param beginCurvature 始点の曲率
 * @param endCurvature 終点の曲率
 * @param length 緩和曲線長
 * @returns 緩和曲線のデータ
 */
export function getTransitionCurveData(beginCurvature: number, endCurvature: number, length: number): TransitionCurveData {
  const s = Math.max(2, Math.round(length / TRANSITION_STEP));

  const position = new THREE.Vector3();
  let rotationY = 0;
  const transitionCurves: TransitionCurveSegment[] = [];

  for (let l = 0; l < s; l++) {
    const t0 = l / s;
    const t1 = (l + 1) / s;
    const curvature = (endCurvature - beginCurvature) * (t0 + t1) / 2 + beginCurvature;

    transitionCurves.push({
      position: position.clone(),
      rotationY,
      curvature,
    });

    const length_ = length / s;
    const radius = 1 / curvature;
    position.add(
      curvature === 0
        ? new THREE.Vector3(1).applyEuler(new THREE.Euler(0, rotationY)).multiplyScalar(length_)
        : new THREE.Vector3(0, 0, radius).applyEuler(new THREE.Euler(0, rotationY))
          .add(new THREE.Vector3(0, 0, -radius).applyEuler(new THREE.Euler(0, length_ / -radius + rotationY)))
    );
    rotationY += length_ / radius;
  }

  return {
    beginCurvature,
    endCurvature,
    endPosition: position,
    endRotationY: rotationY,
    transitionCurves,
  };
}

export const state = proxy<{
  hoveredTracks: string[];
  selectedTrackIds: string[];
  pointingOnTrack?: PointOnTrack;
  hoveredSwitch: string;
}>({
  hoveredTracks: [],
  selectedTrackIds: [],
  hoveredSwitch: "",
});

export function getSelectedTracks(gameState: GameStateType) {
  let tracks: Track[] = [];

  state.selectedTrackIds
    .forEach(trackId => {
      tracks.push(gameState.tracks[trackId]);
    });

  return tracks;
}

export function getPosition(track: Track, length: number): THREE.Vector3 {
  const { position, rotationY, radius, length: curveLength } = track;

  if (length === 0)
    return position.clone();

  const rotation = new THREE.Euler(0, rotationY);

  if ((track as TransitionCurve).endPosition !== undefined) {
    const i = Math.max(0, Math.min((track as TransitionCurve).transitionCurves.length - 1, Math.ceil(length * (track as TransitionCurve).transitionCurves.length / curveLength)));
    const transition = (track as TransitionCurve).transitionCurves[i];
    return getPosition(
      {
        position: transition.position.clone().multiply(new THREE.Vector3(1, 1, (track as TransitionCurve).curveDirection ? 1 : -1)),
        rotationY: (track as TransitionCurve).curveDirection ? transition.rotationY : -transition.rotationY,
        radius: transition.curvature === 0 ? 0 :
          ((track as TransitionCurve).curveDirection ? 1 : -1) / transition.curvature
      } as Track,
      length - i * curveLength / (track as TransitionCurve).transitionCurves.length
    ).applyEuler(rotation).add(position);
  }

  if (radius === 0)
    return position.clone().add(new THREE.Vector3(1).applyEuler(rotation).multiplyScalar(length));
  else
    return position.clone()
      .add(new THREE.Vector3(0, 0, radius).applyEuler(rotation))
      .add(new THREE.Vector3(0, 0, -radius).applyEuler(new THREE.Euler(0, length / -radius + rotationY)));
}

export function getRotation(track: Track, length: number) {
  const { rotationY, radius, length: curveLength } = track;

  const cant = 0;

  if ((track as TransitionCurve).endPosition !== undefined) {
    const i = Math.max(0, Math.min((track as TransitionCurve).transitionCurves.length - 1, Math.ceil(length * (track as TransitionCurve).transitionCurves.length / curveLength)));
    const transition = (track as TransitionCurve).transitionCurves[i];
    return new THREE.Euler(cant, rotationY + ((track as TransitionCurve).curveDirection ? 1 : -1) * (transition.rotationY + (transition.curvature === 0 ? 0 : (length - i * curveLength / (track as TransitionCurve).transitionCurves.length) * transition.curvature)), 0, 'YZX');
  }

  if (radius === 0)
    return new THREE.Euler(cant, rotationY, 0, 'YZX');
  else
    return new THREE.Euler(cant, length / -radius + rotationY, 0, 'YZX');
}

function transitionCurveA(point: THREE.Vector3, transitionCurves: TransitionCurveSegment[], curveDirection: boolean, lengthT: number, i = 0): number {
  const { position, rotationY, curvature } = transitionCurves[i];
  const length = getLength(point.clone().sub(position).applyEuler(new THREE.Euler(0, -rotationY)), {
    position: new THREE.Vector3(),
    rotationY: 0,
    radius: curvature === 0 ? 0 : (curveDirection ? 1 : -1) / curvature,
  } as Track);

  if (lengthT < length) {
    if (i + 1 === transitionCurves.length)
      return i * lengthT + length;
    else
      transitionCurveA(point, transitionCurves, curveDirection, lengthT, i + 1);
  }

  return length;
}

export function getLength(point: THREE.Vector3, track: Track): number {
  const point1 = point.clone().sub(track.position)
    .applyEuler(new THREE.Euler(0, -track.rotationY));

  if ((track as TransitionCurve).endPosition !== undefined) {
    const lengthT = track.length / (track as TransitionCurve).transitionCurves.length;

    // 最初に始点のセグメントの曲率で計算し、始点からの距離がlengthTより遠い場合、再帰的に次のセグメントで計算する
    return transitionCurveA(point1, (track as TransitionCurve).transitionCurves, (track as TransitionCurve).curveDirection, lengthT);
  }

  if (track.radius === 0) {
    return point1.x;
  } else {
    point1.sub(new THREE.Vector3(0, 0, track.radius));

    const eulerY = point1.x === 0 && point1.z === 0 ? 0 :
      Math.atan2(0 < track.radius ? point1.z : -point1.z, point1.x) + Math.PI / 2;

    // TODO 角度が範囲外の場合、近い方に合わせる

    return eulerY * Math.abs(track.radius);
  }
}

export type Switch = {
  connectedTrackIds: string[];
  isConnectedToEnd: boolean[];
  currentConnected: number;
};

export type SerializableSwitch = IdentifiedRecord & Switch;

export const TOLERANCE_FOR_TRACK_CONNECTIONS = 0.1;
