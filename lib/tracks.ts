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

export type TransitionCurveData = {
  beginCurvature: number;
  endCurvature: number;
  endPosition: THREE.Vector3;
  endRotationY: number;
  transitionCurves: {
    position: THREE.Vector3;
    rotationY: number;
    curvature: number;
  }[];
};

export type SerializableTransitionCurveData = {
  beginCurvature: number;
  endCurvature: number;
  endPosition: THREE.Vector3Tuple;
  endRotationY: number;
  transitionCurves: {
    position: THREE.Vector3Tuple;
    rotationY: number;
    curvature: number;
  }[];
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
  const s = Math.round(length / TRANSITION_STEP);

  const position = new THREE.Vector3();
  let rotationY = 0;
  const transitionCurves = [];

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

export function getPosition(position: THREE.Vector3, rotationY: number, length: number, radius: number) {
  if (length === 0)
    return position.clone();

  if (radius === 0)
    return position.clone().add(new THREE.Vector3(1).applyEuler(new THREE.Euler(0, rotationY)).multiplyScalar(length));
  else
    return position.clone()
      .add(new THREE.Vector3(0, 0, radius).applyEuler(new THREE.Euler(0, rotationY)))
      .add(new THREE.Vector3(0, 0, -radius).applyEuler(new THREE.Euler(0, length / -radius + rotationY)));
}

export function getRotation(position: THREE.Vector3, rotationY: number, length: number, radius: number) {
  if (radius === 0)
    return new THREE.Euler(0, rotationY);
  else
    return new THREE.Euler(0, length / -radius + rotationY);
}

export function getLength(point: THREE.Vector3, track: Track) {
  if (track.radius === 0) {
    return point.clone().sub(track.position)
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), getPosition(track.position, track.rotationY, track.length, 0).clone().sub(track.position).normalize()).invert())
      .x;
  } else {
    const position_ = point.clone().sub(track.position)
      .sub(new THREE.Vector3(0, 0, track.radius).applyEuler(new THREE.Euler(0, track.rotationY)))
      .applyEuler(new THREE.Euler(0, -track.rotationY));

    const eulerY = position_.x === 0 && position_.z === 0 ? 0 :
      Math.atan2(0 < track.radius ? position_.z : -position_.z, position_.x) + Math.PI / 2;

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
