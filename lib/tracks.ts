import { Position, lineString } from '@turf/helpers';
import * as THREE from 'three'
import { GameStateType, IdentifiedRecord } from './game';
import { proxy } from 'valtio';
import centroid from '@turf/centroid';
import { coordinateToEuler, getRelativePosition } from './gis';

export type GradientsType = { [key: number]: number };

export type TrackShape = {
  position: THREE.Vector3;
  rotationY: number;
  length: number;
  radius: number; // 正の値が右曲がり
  gradients: GradientsType;
};

export type Track = TrackShape & {
  centerCoordinate: Position;
  idOfTrackOrSwitchConnectedFromStart: string;
  idOfTrackOrSwitchConnectedFromEnd: string;
  connectedFromStartIsTrack: boolean;
  connectedFromEndIsTrack: boolean;
  connectedFromStartIsToEnd: boolean;
  connectedFromEndIsToEnd: boolean;
  beginRotationX: number;
  endRotationX: number;
  modelPaths: string[];
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
  beginRotationX: number;
  endRotationX: number;
  modelPaths: string[];
  gradients: GradientsType;
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
  curveDirection: boolean; // 左曲がりかどうか
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

export function getHeight(length: number, gradients: GradientsType) {
  const keys = Object.keys(gradients);
  let l = Number(keys[0]);
  if (length <= l)
    return gradients[l] * length / 1000;
  let height = gradients[l] * l / 1000;

  for (let n = 1; n < keys.length; n++) {
    const l_ = Number(keys[n]);
    if (gradients[l] === gradients[l_])
      if (length <= l_)
        return height + gradients[l_] * (length - l) / 1000;
      else
        height += gradients[l_] * (l_ - l) / 1000;
    else if (length <= l_)
      return height + (gradients[l] * (length - l)
        + (gradients[l_] - gradients[l]) * (length - l) * (length - l) / (l_ - l) / 2
      ) / 1000;
    else
      height += (gradients[l] * (l_ - l)
        + (gradients[l_] - gradients[l]) * (l_ - l) / 2
      ) / 1000;

    l = l_;
  }

  return height + gradients[l] * (length - l) / 1000;
}

export function getGradient(length: number, gradients: GradientsType) {
  const keys = Object.keys(gradients);
  let l = Number(keys[0]);
  if (length <= l)
    return gradients[l];

  for (let n = 1; n < keys.length; n++) {
    const l_ = Number(keys[n]);
    if (gradients[l] === gradients[l_]) {
      if (length <= l_)
        return gradients[l_];
    } else if (length <= l_)
      return gradients[l] + (gradients[l_] - gradients[l]) * (length - l) / (l_ - l);

    l = l_;
  }

  return gradients[l];
}

export function getPosition(track: TrackShape, length: number): THREE.Vector3 {
  const { position, rotationY, radius, length: curveLength, gradients } = track;

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
          ((track as TransitionCurve).curveDirection ? -1 : 1) / transition.curvature,
        length: 0,
        gradients: { 0: 0 },
      },
      length - i * curveLength / (track as TransitionCurve).transitionCurves.length
    ).applyEuler(rotation).add(position)
      .add(new THREE.Vector3(0, getHeight(length, gradients)));
  }

  if (radius === 0)
    return position.clone().add(new THREE.Vector3(1).applyEuler(rotation).multiplyScalar(length))
      .add(new THREE.Vector3(0, getHeight(length, gradients)));
  else
    return position.clone()
      .add(new THREE.Vector3(0, 0, radius).applyEuler(rotation))
      .add(new THREE.Vector3(0, 0, -radius).applyEuler(new THREE.Euler(0, length / -radius + rotationY)))
      .add(new THREE.Vector3(0, getHeight(length, gradients)));
}

export function getRotation(track: Track, length: number) {
  const { rotationY, radius, length: curveLength, gradients, beginRotationX, endRotationX } = track;

  const cant = beginRotationX + (endRotationX - beginRotationX) * length / curveLength;

  if ((track as TransitionCurve).endPosition !== undefined) {
    const i = Math.max(0, Math.min((track as TransitionCurve).transitionCurves.length - 1, Math.ceil(length * (track as TransitionCurve).transitionCurves.length / curveLength)));
    const transition = (track as TransitionCurve).transitionCurves[i];
    return new THREE.Euler(
      cant,
      rotationY + ((track as TransitionCurve).curveDirection ? 1 : -1) * (transition.rotationY + (transition.curvature === 0 ? 0 : (length - i * curveLength / (track as TransitionCurve).transitionCurves.length) * transition.curvature)),
      Math.atan(getGradient(length, gradients) / 1000),
      'YZX'
    );
  }

  if (radius === 0)
    return new THREE.Euler(
      cant,
      rotationY,
      Math.atan(getGradient(length, gradients) / 1000),
      'YZX'
    );
  else
    return new THREE.Euler(
      cant,
      length / -radius + rotationY,
      Math.atan(getGradient(length, gradients) / 1000),
      'YZX'
    );
}

function transitionCurveA(point: THREE.Vector3, transitionCurves: TransitionCurveSegment[], curveDirection: boolean, lengthT: number, i = 0): number {
  const { position, rotationY, curvature } = transitionCurves[i];
  const length = getLength(point.clone().sub(position).applyEuler(new THREE.Euler(0, -rotationY)), {
    position: new THREE.Vector3(),
    rotationY: 0,
    radius: curvature === 0 ? 0 : (curveDirection ? -1 : 1) / curvature,
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
      Math.atan2(-point1.x, 0 < track.radius ? point1.z : -point1.z) + Math.PI;

    // TODO 角度が範囲外の場合、近い方に合わせる

    return eulerY * Math.abs(track.radius);
  }
}

export function switchTrack(gameState: GameStateType, switchId: number, newCurrentConnected: number) {
  const railroadSwitch = gameState.switches[switchId];

  let connectedTo = "";
  let isConnectedToTrack = true;
  let connectedIsToEnd = false;

  if (railroadSwitch.currentConnected !== -1) {
    const track = gameState.tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];

    if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
      connectedTo = track.idOfTrackOrSwitchConnectedFromEnd;
      isConnectedToTrack = track.connectedFromEndIsTrack;
      connectedIsToEnd = track.connectedFromEndIsToEnd;
      track.idOfTrackOrSwitchConnectedFromEnd = "";
    } else {
      connectedTo = track.idOfTrackOrSwitchConnectedFromStart;
      isConnectedToTrack = track.connectedFromStartIsTrack;
      connectedIsToEnd = track.connectedFromStartIsToEnd;
      track.idOfTrackOrSwitchConnectedFromStart = "";
    }
  }

  railroadSwitch.currentConnected = newCurrentConnected;

  if (railroadSwitch.currentConnected !== -1) {
    const track = gameState.tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];

    if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
      track.idOfTrackOrSwitchConnectedFromEnd = connectedTo;
      track.connectedFromEndIsTrack = isConnectedToTrack;
      track.connectedFromEndIsToEnd = connectedIsToEnd;
    } else {
      track.idOfTrackOrSwitchConnectedFromStart = connectedTo;
      track.connectedFromStartIsTrack = isConnectedToTrack;
      track.connectedFromStartIsToEnd = connectedIsToEnd;
    }
  }
}

export function areParallel(AB: Track, CD: Track) {
  const centerCoordinate = centroid(lineString([AB.centerCoordinate, CD.centerCoordinate])).geometry.coordinates;
  const centerCoordinateEuler = coordinateToEuler(centerCoordinate);

  const trackCenterCoordinates = [
    getRelativePosition(AB.centerCoordinate, centerCoordinateEuler, centerCoordinate, 0),
    getRelativePosition(CD.centerCoordinate, centerCoordinateEuler, centerCoordinate, 0),
  ];

  const pointA = trackCenterCoordinates[0].clone().add(AB.position);
  const pointB = trackCenterCoordinates[0].clone().add(AB.position.clone().add(new THREE.Vector3(1).applyEuler(new THREE.Euler(0, AB.rotationY)).multiplyScalar(AB.length)));
  const pointC = trackCenterCoordinates[1].clone().add(CD.position);
  const pointD = trackCenterCoordinates[1].clone().add(CD.position.clone().add(new THREE.Vector3(1).applyEuler(new THREE.Euler(0, CD.rotationY)).multiplyScalar(CD.length)));

  const s = ((pointC.x - pointA.x) * (pointD.z - pointC.z) - (pointC.z - pointA.z) * (pointD.x - pointC.x))
    / ((pointB.x - pointA.x) * (pointD.z - pointC.z) - (pointB.z - pointA.z) * (pointD.x - pointC.x));

  return Number.isNaN(s);
}

export function createStraightTrackFromLineStrings(coordinatePairs: Position[], modelPaths: string[]) {
  const centerCoordinate = centroid(lineString(coordinatePairs)).geometry.coordinates;
  const centerCoordinateEuler = coordinateToEuler(centerCoordinate);

  const points = coordinatePairs.map(coordinate => getRelativePosition(coordinate, centerCoordinateEuler, centerCoordinate, 0));

  const vector = points[1].clone().sub(points[0]);
  const rotationYA = Math.atan2(-vector.z, vector.x);
  for (let i = 3; i < points.length; i += 2) {
    const vector_ = points[i].clone().sub(points[i - 1]);
    const rotationYB = Math.atan2(-vector_.z, vector_.x);
    if (Math.round((rotationYB - rotationYA) / Math.PI / 2) === 0)
      vector.add(vector_);
    else
      vector.sub(vector_);
  }
  vector.divideScalar(points.length - 1);

  const rotationY = Math.atan2(-vector.z, vector.x);

  let mostNegativeZ = 0;
  let mostPositiveZ = 0;
  points.forEach(point => {
    const z = point.clone().applyEuler(new THREE.Euler(0, -rotationY)).x;
    mostNegativeZ = Math.min(mostNegativeZ, z);
    mostPositiveZ = Math.max(mostPositiveZ, z);
  })

  return {
    centerCoordinate,
    position: vector.clone().setLength(mostNegativeZ),
    rotationY,
    length: mostPositiveZ - mostNegativeZ,
    radius: 0,
    /*startGrade: 0, // TODO grade
    endGrade: 0,*/
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginRotationX: 0,
    endRotationX: 0,
    modelPaths,
    gradients: { 0: 0 },
  } as Track;
}

export type Switch = {
  connectedTrackIds: string[];
  isConnectedToEnd: boolean[];
  currentConnected: number;
};

export type SerializableSwitch = IdentifiedRecord & Switch;

export const TOLERANCE_FOR_TRACK_CONNECTIONS = 0.1;
