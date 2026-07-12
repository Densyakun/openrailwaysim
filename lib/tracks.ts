import { Position } from 'geojson';
import * as THREE from 'three'
import { store, ORSAppDataType } from './game';
import { getRelativePosition } from './gis';

export type GradientsType = { [key: number]: number };

const cV = (v: THREE.Vector3) => v.clone ? v.clone() : new THREE.Vector3().copy(v);
const cE = (e: THREE.Euler) => (e as any).clone ? (e as any).clone() : new THREE.Euler().copy(e); // eslint-disable-line @typescript-eslint/no-explicit-any

export type TrackShape = {
  position: THREE.Vector3;
  rotationY: number;
  length: number;
  radius: number; // 正の値が右曲がり
  trackModels: readonly TrackModel[];
  gradients: GradientsType;
};

export type SerializableTrackShape = {
  position: THREE.Vector3Tuple;
  rotationY: number;
  length: number;
  radius: number;
  gradients: GradientsType;
};

export type Track = TrackShape & {
  idOfTrackOrSwitchConnectedFromStart: string;
  idOfTrackOrSwitchConnectedFromEnd: string;
  connectedFromStartIsTrack: boolean;
  connectedFromEndIsTrack: boolean;
  connectedFromStartIsToEnd: boolean;
  connectedFromEndIsToEnd: boolean;
  beginCant: number;
  endCant: number;
  trackModels: TrackModel[];
};

export type SerializableTrack = SerializableTrackShape & {
  idOfTrackOrSwitchConnectedFromStart: string;
  idOfTrackOrSwitchConnectedFromEnd: string;
  connectedFromStartIsTrack: boolean;
  connectedFromEndIsTrack: boolean;
  connectedFromStartIsToEnd: boolean;
  connectedFromEndIsToEnd: boolean;
  beginCant: number;
  endCant: number;
  trackModels: TrackModel[];
};

export type TrackModel = {
  modelPath: string;
  start: number;
  /**
   * startと同じ値の場合、非連続で設置。-1の場合、終点まで設置
   */
  end: number;
  /**
   * 勾配に合わせて傾けるか
   */
  isInclined: boolean;
  /**
   * カントに合わせて傾けるか
   */
  isTilting: boolean;
  /**
   * オブジェクトの（曲線における弦の長さ）。値が0の場合は軌道の向きに合わせる。値が-1の場合は次に配置される地点に向ける。intervalが0以外の場合に使われる
   */
  span: number;
  /**
   * オブジェクトを設置する平均の間隔。間隔を固定する場合、設置範囲が等倍になるように設定する。値が0かつ連続設置の場合、オブジェクトのスケールZが自動的に変更される（レールを設置するため）
   */
  interval: number;
  /**
   * 最短描画範囲
   */
  minDistance: number;
  /**
   * 最長描画範囲
   */
  maxDistance: number;
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

export function getPosition(track: TrackShape, length: number, overrideGradients?: GradientsType): THREE.Vector3 {
  const { position, rotationY, radius, length: curveLength, gradients } = track;
  const gradientsToUse = overrideGradients || gradients;

  if (length === 0)
    return cV(position);

  const rotation = new THREE.Euler(0, rotationY);

  if ((track as TransitionCurve).endPosition !== undefined) {
    const i = Math.max(0, Math.min((track as TransitionCurve).transitionCurves.length - 1, Math.ceil(length * (track as TransitionCurve).transitionCurves.length / curveLength)));
    const transition = (track as TransitionCurve).transitionCurves[i];
    // TODO 位置が間違っている！（カクカクする）
    return getPosition(
      {
        position: cV(transition.position).multiply(new THREE.Vector3(1, 1, (track as TransitionCurve).curveDirection ? 1 : -1)),
        rotationY: (track as TransitionCurve).curveDirection ? transition.rotationY : -transition.rotationY,
        radius: transition.curvature === 0 ? 0 :
          ((track as TransitionCurve).curveDirection ? -1 : 1) / transition.curvature,
        length: 0,
        trackModels: [],
        gradients: { 0: 0 },
      },
      length - i * curveLength / (track as TransitionCurve).transitionCurves.length,
      gradientsToUse
    ).applyEuler(rotation).add(cV(position))
      .add(new THREE.Vector3(0, getHeight(length, gradientsToUse)));
  }

  if (radius === 0)
    return cV(position).add(new THREE.Vector3(1).applyEuler(rotation).multiplyScalar(length))
      .add(new THREE.Vector3(0, getHeight(length, gradientsToUse)));
  else
    return cV(position)
      .add(new THREE.Vector3(0, 0, radius).applyEuler(rotation))
      .add(new THREE.Vector3(0, 0, -radius).applyEuler(new THREE.Euler(0, length / -radius + rotationY)))
      .add(new THREE.Vector3(0, getHeight(length, gradientsToUse)));
}

export function getCant(track: Track, length: number) {
  const { length: curveLength, beginCant, endCant } = track;
  return beginCant + (endCant - beginCant) * length / curveLength;
}

export function getRotation(track: Track, length: number) {
  const { rotationY, radius, length: curveLength, gradients } = track;

  const cant = getCant(track, length);

  if ((track as TransitionCurve).endPosition !== undefined) {
    const i = Math.max(0, Math.min((track as TransitionCurve).transitionCurves.length - 1, Math.ceil(length * (track as TransitionCurve).transitionCurves.length / curveLength)));
    const transition = (track as TransitionCurve).transitionCurves[i];
    return new THREE.Euler(
      Math.atan(getGradient(length, gradients) / 1000),
      rotationY + ((track as TransitionCurve).curveDirection ? 1 : -1) * (transition.rotationY + (transition.curvature === 0 ? 0 : (length - i * curveLength / (track as TransitionCurve).transitionCurves.length) * transition.curvature)) - Math.PI / 2,
      -cant,
      'YXZ'
    );
  }

  if (radius === 0)
    return new THREE.Euler(
      Math.atan(getGradient(length, gradients) / 1000),
      rotationY - Math.PI / 2,
      -cant,
      'YXZ'
    );
  else
    return new THREE.Euler(
      Math.atan(getGradient(length, gradients) / 1000),
      length / -radius + rotationY - Math.PI / 2,
      -cant,
      'YXZ'
    );
}

function transitionCurveA(point: THREE.Vector3, transitionCurves: TransitionCurveSegment[], lengthT: number, i = 0): number {
  const { position, rotationY, curvature } = transitionCurves[i];
  const length = getLength(point, {
    position,
    rotationY,
    radius: curvature === 0 ? 0 : -1 / curvature,
    length: lengthT,
  } as Track);

  return lengthT < length && i + 1 !== transitionCurves.length
    ? lengthT + transitionCurveA(point, transitionCurves, lengthT, i + 1)
    : length;
}

export function getLength(point: THREE.Vector3, track: Track): number {
  const point1 = cV(point).sub(cV(track.position))
    .applyEuler(new THREE.Euler(0, -track.rotationY));

  if ((track as TransitionCurve).endPosition !== undefined) {
    const lengthT = track.length / (track as TransitionCurve).transitionCurves.length;

    // 最初に始点のセグメントの曲率で計算し、始点からの距離がlengthTより遠い場合、再帰的に次のセグメントで計算する
    return transitionCurveA(
      point1.multiply(new THREE.Vector3(1, 1, (track as TransitionCurve).curveDirection ? 1 : -1)),
      (track as TransitionCurve).transitionCurves,
      lengthT
    );
  }

  if (track.radius === 0) {
    return point1.x;
  } else {
    point1.sub(new THREE.Vector3(0, 0, track.radius));

    const eulerY = point1.x === 0 && point1.z === 0 ? 0 :
      Math.atan2(-point1.x, 0 < track.radius ? point1.z : -point1.z) + Math.PI;

    const r = Math.abs(track.radius);
    const l = eulerY * r;
    return (track.length + 2 * Math.PI * r) / 2 <= l ? l - 2 * Math.PI * r : l;
  }
}

export function switchTrack(switchId: string, newCurrentConnected: number) {
  const data = store.data;
  const railroadSwitch = data.switches[switchId];

  let connectedTo = "";
  let isConnectedToTrack = true;
  let connectedIsToEnd = false;

  if (railroadSwitch.currentConnected !== -1) {
    const track = data.tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];

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
    const track = data.tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];

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

export function createStraightTrackFromLineStrings(
  originCoordinate: Position,
  coordinatePairs: Position[],
  trackModels: TrackModel[] = []
) {
  const points: THREE.Vector3[] = coordinatePairs.map(c => getRelativePosition(c, originCoordinate));

  const numLines = points.length / 2;
  if (numLines < 1) throw new Error();

  const sumVec = new THREE.Vector3();
  for (let i = 0; i < points.length; i += 2) {
    const a = points[i];
    const b = points[i + 1];
    const v = cV(b).sub(cV(a));
    if (sumVec.lengthSq() === 0) {
      sumVec.copy(v);
    } else {
      if (sumVec.dot(v) < 0) v.negate();
      sumVec.add(v);
    }
  }

  const avgDir = cV(sumVec).divideScalar(numLines).normalize();
  const rotationY = Math.atan2(-avgDir.z, avgDir.x);

  const base = cV(points[0]);

  let minProj = Infinity;
  let maxProj = -Infinity;
  points.forEach(p => {
    const proj = cV(p).sub(base).dot(avgDir);
    if (proj < minProj) minProj = proj;
    if (proj > maxProj) maxProj = proj;
  });

  const startPos = cV(base).add(cV(avgDir).multiplyScalar(minProj));
  const length = maxProj - minProj;

  return {
    position: startPos,
    rotationY,
    length,
    radius: 0,
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: 0,
    endCant: 0,
    trackModels,
    gradients: { 0: 0 },
  } as Track;
}

export type Switch = {
  connectedTrackIds: string[];
  isConnectedToEnd: boolean[];
  currentConnected: number;
};

export const TOLERANCE_FOR_TRACK_CONNECTIONS = 0.01;

/**
 * ベースとなる既存の軌道から直列化可能な軌道を作成する
 * @param baseTrack ベースとなる軌道
 * @param startLengthS baseTrackの開始位置。デフォルトは 0
 * @param endLengthS baseTrackの終了位置。デフォルトは 1
 * @param beginCant デフォルトは baseTrack.beginCant
 * @param endCant デフォルトは baseTrack.endCant
 * @param trackModels デフォルトは baseTrack.trackModels
 * @returns 直列化可能な軌道
 */
export function createSerializableTrackBasedOnTrack(
  baseTrack: Track,
  startLengthS = 0,
  endLengthS = 1,
  beginCant = baseTrack.beginCant,
  endCant = baseTrack.endCant,
  trackModels = baseTrack.trackModels,
) {
  const serializableTrack: SerializableTrack = {
    position: getPosition(baseTrack, baseTrack.length * startLengthS).toArray(),
    length: baseTrack.length * (endLengthS - startLengthS),
    radius: baseTrack.radius,
    rotationY: baseTrack.rotationY,
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    gradients: { 0: 0 },
    beginCant,
    endCant,
    trackModels,
  };

  return serializableTrack;
}

export function applyTransitionCurveToSerializableTrack(serializableTrack: SerializableTrack, transitionCurve: TransitionCurve) {
  return serializableTrack = {
    ...serializableTrack,
    beginCurvature: transitionCurve.beginCurvature,
    endCurvature: transitionCurve.endCurvature,
    endPosition: transitionCurve.endPosition.toArray(),
    endRotationY: transitionCurve.endRotationY,
    transitionCurves: transitionCurve.transitionCurves.map(value => ({
      position: value.position.toArray(),
      rotationY: value.rotationY,
      curvature: value.curvature,
    })),
    curveDirection: transitionCurve.curveDirection,
  } as SerializableTransitionCurve;
}

export function runPointOnTrack(pointOnTrack: PointOnTrack, directionIsReversed: boolean, distance: number, customTracks?: { [trackId: string]: Track }) {
  const data = store.data;
  const tracks = customTracks || data.tracks;
  let newPointOnTrack: PointOnTrack = { ...pointOnTrack };
  let newDirectionIsReversed = directionIsReversed;
  let isDeadEnd = false;

  if (directionIsReversed) {
    newPointOnTrack.length -= distance;
  } else {
    newPointOnTrack.length += distance;
  }

  if (newPointOnTrack.length < 0) {
    // 輪軸が軌道の始点より外に進入した場合
    const track = tracks[newPointOnTrack.trackId];
    if (track.idOfTrackOrSwitchConnectedFromStart) {
      if (track.connectedFromStartIsTrack) {
        const connectedTo = tracks[track.idOfTrackOrSwitchConnectedFromStart];
        if (track.connectedFromStartIsToEnd) {
          newPointOnTrack = {
            trackId: track.idOfTrackOrSwitchConnectedFromStart,
            length: connectedTo.length + newPointOnTrack.length,
          };
        } else {
          // 軌道の始点側に進入する場合
          newPointOnTrack = {
            trackId: track.idOfTrackOrSwitchConnectedFromStart,
            length: -newPointOnTrack.length,
          };
          // 軌道に対する輪軸の進行方向を反転する
          newDirectionIsReversed = !directionIsReversed;
        }
      } else {
        // 分岐器が接続している軌道を取得する
        const railroadSwitch = data.switches[track.idOfTrackOrSwitchConnectedFromStart];
        if (!railroadSwitch || railroadSwitch.currentConnected === -1) {
          // 接続先がない場合
          isDeadEnd = true;
          newPointOnTrack.length = 0;
        } else {
          const connectedTo = tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];
          if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
            newPointOnTrack = {
              trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
              length: connectedTo.length + newPointOnTrack.length,
            };
          } else {
            newPointOnTrack = {
              trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
              length: -newPointOnTrack.length,
            };
            newDirectionIsReversed = !directionIsReversed;
          }
        }
      }
    } else {
      // 接続先がない場合
      isDeadEnd = true;
      newPointOnTrack.length = 0;
    }
  } else {
    const track = tracks[newPointOnTrack.trackId];
    if (track.length < newPointOnTrack.length) {
      // 輪軸が軌道の終点より外に進入した場合
      if (track.idOfTrackOrSwitchConnectedFromEnd) {
        if (track.connectedFromEndIsTrack) {
          const connectedTo = tracks[track.idOfTrackOrSwitchConnectedFromEnd];
          if (track.connectedFromEndIsToEnd) {
            newPointOnTrack = {
              trackId: track.idOfTrackOrSwitchConnectedFromEnd,
              length: connectedTo.length + track.length - newPointOnTrack.length,
            };
            newDirectionIsReversed = !directionIsReversed;
          } else {
            newPointOnTrack = {
              trackId: track.idOfTrackOrSwitchConnectedFromEnd,
              length: newPointOnTrack.length - track.length,
            };
          }
        } else {
          const railroadSwitch = data.switches[track.idOfTrackOrSwitchConnectedFromEnd];
          if (!railroadSwitch || railroadSwitch.currentConnected === -1) {
            // 接続先がない場合
            isDeadEnd = true;
            newPointOnTrack.length = track.length;
          } else {
            const connectedTo = tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];
            if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
              newPointOnTrack = {
                trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
                length: connectedTo.length + track.length - newPointOnTrack.length,
              };
              newDirectionIsReversed = !directionIsReversed;
            } else {
              newPointOnTrack = {
                trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
                length: newPointOnTrack.length - track.length,
              };
            }
          }
        }
      } else {
        // 接続先がない場合
        isDeadEnd = true;
        newPointOnTrack.length = track.length;
      }
    }
  }

  return {
    newPointOnTrack,
    newDirectionIsReversed,
    isDeadEnd,
  };
}

/**
 * 2つの軌道を接続する
 */
export function connectTwoTracks(AB: Track | SerializableTrack, ABId: string, isABFromEnd: boolean, CD: Track | SerializableTrack, CDId: string, isCDFromEnd: boolean) {
  if (isABFromEnd) {
    AB.idOfTrackOrSwitchConnectedFromEnd = CDId;
    AB.connectedFromEndIsTrack = true;
    AB.connectedFromEndIsToEnd = isCDFromEnd;
  } else {
    AB.idOfTrackOrSwitchConnectedFromStart = CDId;
    AB.connectedFromStartIsTrack = true;
    AB.connectedFromStartIsToEnd = isCDFromEnd;
  }

  if (isCDFromEnd) {
    CD.idOfTrackOrSwitchConnectedFromEnd = ABId;
    CD.connectedFromEndIsTrack = true;
    CD.connectedFromEndIsToEnd = isABFromEnd;
  } else {
    CD.idOfTrackOrSwitchConnectedFromStart = ABId;
    CD.connectedFromStartIsTrack = true;
    CD.connectedFromStartIsToEnd = isABFromEnd;
  }
}

export function getDistance(trackIds: string[], toLength: number, fromLength: number, i = 0): number | undefined {
  const data = store.data;
  const trackId = trackIds[i];
  if (i + 1 === trackIds.length)
    return toLength - fromLength;
  else {
    const track = data.tracks[trackId];
    const nextTrackId = trackIds[i + 1];
    if (track.connectedFromStartIsTrack) {
      if (track.idOfTrackOrSwitchConnectedFromStart === nextTrackId) {
        if (track.connectedFromStartIsToEnd) {
          const nextTrack = data.tracks[nextTrackId];
          const d = getDistance(trackIds, toLength, nextTrack.length, i + 1);
          if (d !== undefined)
            return d - fromLength;
        } else {
          const d = getDistance(trackIds, toLength, 0, i + 1);
          if (d !== undefined)
            return -d - fromLength;
        }
      }
    } else {
      const railroadSwitch = data.switches[track.idOfTrackOrSwitchConnectedFromStart];
      const i1 = railroadSwitch.connectedTrackIds.indexOf(nextTrackId);
      if (0 <= i1) {
        if (railroadSwitch.isConnectedToEnd[i1]) {
          const nextTrack = data.tracks[nextTrackId];
          const d = getDistance(trackIds, toLength, nextTrack.length, i + 1);
          if (d !== undefined)
            return d - fromLength;
        } else {
          const d = getDistance(trackIds, toLength, 0, i + 1);
          if (d !== undefined)
            return -d - fromLength;
        }
      }
    }
    if (track.connectedFromEndIsTrack) {
      if (track.idOfTrackOrSwitchConnectedFromEnd === nextTrackId) {
        if (track.connectedFromEndIsToEnd) {
          const nextTrack = data.tracks[nextTrackId];
          const d = getDistance(trackIds, toLength, nextTrack.length, i + 1);
          if (d !== undefined)
            return track.length - fromLength - d;
        } else {
          const d = getDistance(trackIds, toLength, 0, i + 1);
          if (d !== undefined)
            return track.length - fromLength + d;
        }
      }
    } else {
      const railroadSwitch = data.switches[track.idOfTrackOrSwitchConnectedFromEnd];
      const i1 = railroadSwitch.connectedTrackIds.indexOf(nextTrackId);
      if (0 <= i1) {
        if (railroadSwitch.isConnectedToEnd[i1]) {
          const nextTrack = data.tracks[nextTrackId];
          const d = getDistance(trackIds, toLength, nextTrack.length, i + 1);
          if (d !== undefined)
            return track.length - fromLength - d;
        } else {
          const d = getDistance(trackIds, toLength, 0, i + 1);
          if (d !== undefined)
            return track.length - fromLength + d;
        }
      }
    }
  }
}

/**
 * 車両偏倚量計算用の定数
 */
export const VEHICLE_OFFSET_CONSTANT = 24000; // 車両偏倚量計算の係数（変更可能）

/**
 * 曲率半径から車両偏倚量（m）を計算
 * @param radius 曲率半径
 * @param offsetConstant 車両偏倚量計算用定数
 * @returns 車両偏倚量
 */
export function calculateVehicleOffset(radius: number, offsetConstant: number = VEHICLE_OFFSET_CONSTANT): number {
  if (radius === 0) return 0;
  return offsetConstant / Math.abs(radius) / 1000;
}

/**
 * 曲線の軌道中心間隔を方程式で解く
 * 既設線の半径、車両偏倚量、オフセット量（=拡大前の軌道中心間隔）から新設線の半径と軌道中心間隔を計算
 * 
 * |R_new| = |R_old| - D - K/|R_old| - K/|R_new|  （内側にオフセットする場合）
 * これを |R_new| について解く（二次方程式）
 * 
 * @param existingRadius 既設線の半径
 * @param offsetDistance オフセット量（拡大前の軌道中心間隔）
 * @param vehicleOffsetConstant 車両偏倚量計算用定数
 * @returns 新設線の半径と軌道中心間隔
 */
export function calculateCurveOffsetRadius(
  existingRadius: number,
  offsetDistance: number,
  vehicleOffsetConstant: number = VEHICLE_OFFSET_CONSTANT
): { newRadius: number; trackCenterDistance: number } {
  const K = vehicleOffsetConstant / 1000;
  const absR_old = Math.abs(existingRadius);
  const isRightCurve = existingRadius > 0;

  // |R_new| = |R_old| - D - K/|R_old| - K/|R_new|
  // => |R_new|² + (D + K/|R_old| - |R_old|)·|R_new| + K = 0
  const b = offsetDistance + (absR_old > 0 ? K / absR_old : 0) - absR_old;
  const c = K;

  const discriminant = b * b - 4 * c;

  let absR_new: number;
  if (discriminant >= 0) {
    const sqrtD = Math.sqrt(discriminant);
    // r1 は常に大きい方の解（(-b + sqrtD) / 2）
    // 小さい方の解 r2 = (-b - sqrtD) / 2 は常に K/|R_old| 付近のスプリアス
    // 内側オフセット (D>0) → r1 < |R_old|
    // 外側オフセット (D<0) → r1 > |R_old|
    // いずれの場合も r1 が正し解
    const r1 = (-b + sqrtD) / 2;
    const r2 = (-b - sqrtD) / 2;

    if (r1 > 0) {
      absR_new = r1;
    } else if (r2 > 0) {
      absR_new = r2;
    } else {
      absR_new = Math.max(1, absR_old - offsetDistance - (absR_old > 0 ? 2 * K / absR_old : 0));
    }
  } else {
    absR_new = Math.max(1, absR_old - offsetDistance - (absR_old > 0 ? 2 * K / absR_old : 0));
  }

  if (absR_new <= 0) {
    absR_new = Math.max(1, absR_old / 2);
  }

  const vehicleOffsetExisting = calculateVehicleOffset(existingRadius, vehicleOffsetConstant);
  const vehicleOffsetNew = calculateVehicleOffset(isRightCurve ? absR_new : -absR_new, vehicleOffsetConstant);
  const trackCenterDistance = offsetDistance + vehicleOffsetExisting + vehicleOffsetNew;

  return {
    newRadius: isRightCurve ? absR_new : -absR_new,
    trackCenterDistance,
  };
}

/**
 * 緩和曲線を作成
 * @param position 緩和曲線の位置
 * @param rotationY 緩和曲線の回転
 * @param transitionLength 緩和曲線長
 * @param curveRadius 曲線半径
 * @param curveDirection 曲線方向
 * @param trackModels トラックモデル
 * @returns 緩和曲線
 */
export function createTransitionCurve(
  position: THREE.Vector3 | [number, number, number],
  rotationY: number,
  transitionLength: number,
  curveRadius: number,
  curveDirection: boolean,
  trackModels: TrackModel[] = []
): SerializableTrack {
  const positionArray = Array.isArray(position) ? position : position.toArray();
  const signedEndCurve = curveDirection ? -1 / curveRadius : 1 / curveRadius;
  const transitionData = getTransitionCurveData(0, signedEndCurve, transitionLength);
  const transitionTrack: SerializableTrack = {
    position: positionArray,
    rotationY,
    length: transitionLength,
    radius: 0,
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: 0,
    endCant: 0,
    trackModels,
    gradients: { 0: 0 },
  };
  applyTransitionCurveToSerializableTrack(transitionTrack, {
    ...transitionData,
    curveDirection: true,
  } as TransitionCurve);
  return transitionTrack;
}

/**
 * 直線軌道をオフセットして敷設
 * @param track ベースとなる軌道
 * @param offsetDistance オフセット距離（正の値で左側、負の値で右側）
 * @param trackModels トラックモデル
 * @returns オフセットされた軌道
 */
export function offsetStraightTrack(track: Track, offsetDistance: number, trackModels: TrackModel[] = []): SerializableTrack {
  const direction = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, track.rotationY));
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  
  const offsetPosition = cV(track.position).add(perpendicular.multiplyScalar(offsetDistance));
  
  return {
    position: offsetPosition.toArray(),
    rotationY: track.rotationY,
    length: track.length,
    radius: 0,
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: track.beginCant,
    endCant: track.endCant,
    trackModels: trackModels.length > 0 ? trackModels : track.trackModels,
    gradients: { ...track.gradients },
  };
}

/**
 * 曲線軌道をオフセットして敷設
 * @param track ベースとなる曲線軌道
 * @param offsetDistance オフセット距離（正の値で外側、負の値で内側）
 * @param vehicleOffsetConstant 車両偏倚量計算用定数
 * @param trackModels トラックモデル
 * @returns オフセットされた軌道
 */
export function offsetCurveTrack(track: Track, offsetDistance: number, vehicleOffsetConstant: number = VEHICLE_OFFSET_CONSTANT, trackModels: TrackModel[] = []): SerializableTrack {
  const result = calculateCurveOffsetRadius(track.radius, offsetDistance, vehicleOffsetConstant);
  const adjustedRadius = result.newRadius;

  const centerOffset = new THREE.Vector3(0, 0, track.radius).applyEuler(new THREE.Euler(0, track.rotationY));
  const adjustedCenterOffset = new THREE.Vector3(0, 0, adjustedRadius).applyEuler(new THREE.Euler(0, track.rotationY));

  const offsetPosition = cV(track.position).add(centerOffset).sub(adjustedCenterOffset);

  return {
    position: offsetPosition.toArray(),
    rotationY: track.rotationY,
    length: track.length * Math.abs(adjustedRadius / track.radius),
    radius: adjustedRadius,
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: track.beginCant,
    endCant: track.endCant,
    trackModels: trackModels.length > 0 ? trackModels : track.trackModels,
    gradients: { ...track.gradients },
  };
}

/**
 * 直線と円曲線の間に緩和曲線を挿入する
 * create new curve 機能とは異なり、直線と円曲線を先に作成し、その間に緩和曲線を挿入する
 * 直線が円の外側にある必要があり、離れすぎていると設置できない
 * getTransitionCurveData の endPosition.z が直線と円の距離と一致するように反復計算する
 * 
 * @param straightTrack オフセットされた直線軌道
 * @param curveTrack オフセットされた曲線軌道
 * @param transitionLength 緩和曲線長（0以下の場合は計算しない）
 * @param trackModels トラックモデル
 * @returns 直線、緩和曲線、円曲線の配列。設置できない場合は null
 */
export function connectStraightToCurveWithTransition(
  straightTrack: SerializableTrack,
  curveTrack: SerializableTrack,
  transitionLength: number,
  trackModels: TrackModel[] = []
): SerializableTrack[] | null {
  const straightPos = new THREE.Vector3(...straightTrack.position);
  const straightRotationY = straightTrack.rotationY;
  const curvePos = new THREE.Vector3(...curveTrack.position);
  const curveRotationY = curveTrack.rotationY;
  const curveRadius = Math.abs(curveTrack.radius);
  const isRightCurve = curveTrack.radius > 0;

  // 円曲線の中心を計算
  const centerOffset = new THREE.Vector3(0, 0, curveTrack.radius).applyEuler(new THREE.Euler(0, curveRotationY));
  const circleCenter = cV(curvePos).add(centerOffset);

  // 直線の方向
  const direction = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, straightRotationY));
  const ABVector = direction.clone().multiplyScalar(straightTrack.length);
  const pointA = straightPos;
  const pointB = cV(pointA).add(ABVector);

  // 直線ローカル座標系で円中心を表す
  const circleCenterLocal = cV(circleCenter).sub(pointA).applyEuler(new THREE.Euler(0, -straightRotationY));
  const cz = circleCenterLocal.z;

  // 直線から円までの垂線距離
  const distanceToCircleEdge = Math.abs(cz) - curveRadius;

  // 直線が円の外側にない（内側または交差している）場合は設置できない
  if (distanceToCircleEdge <= 0) {
    return null;
  }

  // 目標のオフセット距離（endPosition.z に一致させる値）
  const targetOffset = distanceToCircleEdge;

  if (transitionLength <= 0) {
    // 緩和曲線なしで直線と円曲線を接続
    return [straightTrack, curveTrack];
  }

  // 反復計算で適切な緩和曲線長を求める
  // endPosition.z が targetOffset に一致するように二分探索
  let low = 1;
  let high = 300;
  let bestL = transitionLength;
  let bestError = Infinity;
  let bestData: TransitionCurveData | null = null;
  const signedEndCurve = isRightCurve ? -1 / curveRadius : 1 / curveRadius;

  for (let iter = 0; iter < 100; iter++) {
    const mid = (low + high) / 2;
    const td = getTransitionCurveData(0, signedEndCurve, mid);
    const error = Math.abs(Math.abs(td.endPosition.z) - targetOffset);

    if (error < bestError) {
      bestError = error;
      bestL = mid;
      bestData = td;
    }

    if (error <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
      bestL = mid;
      bestData = td;
      break;
    }

    if (high - low < 0.01) {
      break;
    }

    // Math.abs(endPosition.z) は L に対して単調増加
    if (Math.abs(td.endPosition.z) < targetOffset) {
      low = mid;
    } else {
      high = mid;
    }
  }

  if (!bestData || bestError > TOLERANCE_FOR_TRACK_CONNECTIONS) {
    // 緩和曲線長の調整では誤差が許容範囲に収まらない場合、
    // 元の transitionLength を使用する（近似で設置）
    bestL = transitionLength;
    bestData = getTransitionCurveData(0, signedEndCurve, transitionLength);
  }

  const transitionData = bestData;
  const endX = transitionData.endPosition.x;
  const endZ = cz > 0 ? targetOffset : -targetOffset;

  // 円中心の x 座標（直線ローカル座標系）
  const cx = circleCenterLocal.x;

  // 緩和曲線の開始位置（直線上の距離）
  // 緩和曲線終点 = (startX + endX, 0, endZ) が円上にある条件：
  // (startX + endX - cx)² + (endZ - cz)² = curveRadius²
  // endZ = cz - sign(cz) * curveRadius より (endZ - cz)² = curveRadius²
  // よって startX + endX - cx = 0 → startX = cx - endX
  const transitionStartX = cx - endX;

  // 直線の範囲内かチェック
  if (transitionStartX < 0 || transitionStartX > straightTrack.length) {
    return null;
  }

  // 緩和曲線の作成
  const transitionStartPos = cV(pointA).add(direction.clone().multiplyScalar(transitionStartX));
  const transitionTrack = createTransitionCurve(
    transitionStartPos.toArray(),
    straightRotationY,
    bestL,
    curveRadius,
    isRightCurve,
    trackModels
  );

  // 直線軌道を短縮（緩和曲線開始位置で終了）
  const shortenedStraight: SerializableTrack = {
    ...straightTrack,
    length: transitionStartX,
  };

  return [shortenedStraight, transitionTrack, curveTrack];
}

/**
 * 曲線から直線への緩和曲線を挿入する
 * 曲線終点から直線に向けて、曲率 1/R → 0 の緩和曲線を配置する
 * getTransitionCurveData(1/R, 0, L) の endPosition.z が
 * 曲線終点から直線までのオフセット量と一致するように反復計算する
 * 
 * @param curveTrack オフセットされた曲線軌道
 * @param straightTrack オフセットされた直線軌道
 * @param transitionLength 緩和曲線長
 * @param trackModels トラックモデル
 * @returns 曲線、緩和曲線、直線の配列。設置できない場合は null
 */
export function connectCurveToStraightWithTransition(
  curveTrack: SerializableTrack,
  straightTrack: SerializableTrack,
  transitionLength: number,
  trackModels: TrackModel[] = []
): SerializableTrack[] | null {
  if (transitionLength <= 0) {
    return [curveTrack, straightTrack];
  }

  const curvePos = new THREE.Vector3(...curveTrack.position);
  const curveRadius = Math.abs(curveTrack.radius);
  const isRightCurve = curveTrack.radius > 0;
  const beginCurvature = curveTrack.radius !== 0 ? -1 / curveTrack.radius : 0;

  // 曲線終点と接線方向
  const curveEndPos = getPosition({
    position: curvePos,
    rotationY: curveTrack.rotationY,
    length: curveTrack.length,
    radius: curveTrack.radius,
    trackModels: [],
    gradients: { 0: 0 },
  }, curveTrack.length);

  const curveEndRotY = curveTrack.rotationY - curveTrack.length / curveTrack.radius;

  const straightPos = new THREE.Vector3(...straightTrack.position);
  const straightRotY = straightTrack.rotationY;

  // 曲線終点のローカル座標系での直線始点
  const tangent = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, curveEndRotY));
  const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x);

  const relToCurveEnd = cV(straightPos).sub(curveEndPos);
  const sz = relToCurveEnd.dot(perpendicular); // 曲線終点から直線までの横方向距離

  // 曲線終点→直線への緩和曲線の横方向オフセット目標値
  // getTransitionCurveData(1/R, 0, L) の endPosition.z がこの値に一致するよう探索
  const targetLateral = Math.abs(sz);

  // 曲線→直線の方向差と一致するか検証
  // getTransitionCurveData(1/R, 0, L) の endRotationY は曲率変化による角度変化量
  // これが直線方向 - 曲線終点接線方向 と一致する必要がある

  // 二分探索で最適な緩和曲線長を求める
  let low = 1;
  let high = 300;
  let bestL = transitionLength;
  let bestError = Infinity;
  let bestData: TransitionCurveData | null = null;

  for (let iter = 0; iter < 100; iter++) {
    const mid = (low + high) / 2;
    const td = getTransitionCurveData(beginCurvature, 0, mid);
    const error = Math.abs(Math.abs(td.endPosition.z) - targetLateral);

    if (error < bestError) {
      bestError = error;
      bestL = mid;
      bestData = td;
    }

    if (error <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
      bestL = mid;
      bestData = td;
      break;
    }

    if (high - low < 0.01) break;

    // endPosition.z は L に対して単調増加（絶対値）
    if (Math.abs(td.endPosition.z) < targetLateral) {
      low = mid;
    } else {
      high = mid;
    }
  }

  if (!bestData || bestError > TOLERANCE_FOR_TRACK_CONNECTIONS) {
    bestL = transitionLength;
    bestData = getTransitionCurveData(beginCurvature, 0, transitionLength);
  }

  const transitionData = bestData;
  const endX = transitionData.endPosition.x;
  const endZ = sz >= 0 ? Math.abs(transitionData.endPosition.z) : -Math.abs(transitionData.endPosition.z);

  // 緩和曲線終点位置
  const transEndLocal = new THREE.Vector3(endX, 0, endZ);
  const transEndWorld = cV(curveEndPos)
    .add(tangent.clone().multiplyScalar(transEndLocal.x))
    .add(perpendicular.clone().multiplyScalar(transEndLocal.z));

  // 直線の方向
  const straightDir = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, straightRotY));

  // 緩和曲線終点から直線始点への投影距離
  const fromStraightStart = cV(transEndWorld).sub(straightPos).dot(straightDir);

  // 緩和曲線終点が直線の範囲外の場合は設置できない
  if (fromStraightStart < 0 || fromStraightStart > straightTrack.length) {
    return null;
  }

  // 緩和曲線レコードを作成
  const transitionTrack: SerializableTrack = {
    position: curveEndPos.toArray(),
    rotationY: curveEndRotY,
    length: bestL,
    radius: 0,
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: 0,
    endCant: 0,
    trackModels,
    gradients: { 0: 0 },
  };
  applyTransitionCurveToSerializableTrack(transitionTrack, {
    ...transitionData,
    curveDirection: true,
  } as TransitionCurve);

  // 緩和曲線終点から直線終点までの短縮直線
  const shortenedStraight: SerializableTrack = {
    ...straightTrack,
    position: transEndWorld.toArray(),
    length: straightTrack.length - fromStraightStart,
  };

  return [curveTrack, transitionTrack, shortenedStraight];
}

/**
 * 軌道ルートに対してオフセット敷設を行う
 * 直線と円曲線をそれぞれ個別にオフセットし、その間に緩和曲線を挿入する
 * create new curve 機能（2直線間に曲線+緩和曲線を一括作成）とは異なる方式
 * 
 * @param trackIds オフセット対象の軌道ID配列
 * @param offsetDistance オフセット距離
 * @param vehicleOffsetConstant 車両偏倚量計算用定数
 * @param trackModels トラックモデル
 * @returns オフセットされた軌道の配列
 */
export function offsetTrackRoute(
  trackIds: string[],
  offsetDistance: number,
  vehicleOffsetConstant: number = VEHICLE_OFFSET_CONSTANT,
  trackModels: TrackModel[] = []
): SerializableTrack[] {
  const data = store.data;

  // 非緩和曲線トラックの配列を作成（緩和曲線はスキップ）
  const originalTracks: Track[] = [];
  for (const trackId of trackIds) {
    const track = data.tracks[trackId];
    if (!track) continue;
    if ((track as TransitionCurve).transitionCurves !== undefined) continue;
    originalTracks.push(track);
  }

  if (originalTracks.length === 0) return [];

  // 全トラックのオフセットを作成
  const offsetTrackList: (SerializableTrack | null)[] = [];
  for (const track of originalTracks) {
    if (track.radius === 0) {
      offsetTrackList.push(offsetStraightTrack(track, offsetDistance, trackModels));
    } else {
      offsetTrackList.push(offsetCurveTrack(track, offsetDistance, vehicleOffsetConstant, trackModels));
    }
  }

  // 隣接ペアごとに接続結果を計算
  // 各ペアの結果: [track_i', trans?, track_i+1'] (2または3要素)
  const pairResults: (SerializableTrack[] | null)[] = [];

  for (let i = 0; i < offsetTrackList.length - 1; i++) {
    const currentTrack = offsetTrackList[i];
    const nextTrack = offsetTrackList[i + 1];
    if (!currentTrack || !nextTrack) {
      pairResults.push(null);
      continue;
    }

    const currentIsStraight = currentTrack.radius === 0;
    const nextIsStraight = nextTrack.radius === 0;

    if (currentIsStraight && !nextIsStraight) {
      const absR = Math.abs(nextTrack.radius);
      const transLen = Math.max(20, Math.min(100, 200 / absR));
      const connection = connectStraightToCurveWithTransition(
        currentTrack, nextTrack, transLen, trackModels
      );
      pairResults.push(connection);
    } else if (!currentIsStraight && nextIsStraight) {
      const absR = Math.abs(currentTrack.radius);
      const transLen = Math.max(20, Math.min(100, 200 / absR));
      const connection = connectCurveToStraightWithTransition(
        currentTrack, nextTrack, transLen, trackModels
      );
      pairResults.push(connection);
    } else {
      pairResults.push(null);
    }
  }

  // 結果をマージ
  const finalTracks: SerializableTrack[] = [];
  if (offsetTrackList.length > 0 && offsetTrackList[0]) {
    finalTracks.push(offsetTrackList[0]);
  }

  for (let i = 0; i < pairResults.length; i++) {
    const pairResult = pairResults[i];
    if (pairResult) {
      // 接続成功: 最後のトラックを置き換え（最初の要素は直前の finalTracks の末尾と同じ）
      finalTracks.pop();
      finalTracks.push(...pairResult);
    } else {
      // 接続失敗/不要: 次のトラックを追加
      const nextTrack = offsetTrackList[i + 1];
      if (nextTrack) {
        finalTracks.push(nextTrack);
      }
    }
  }

  return finalTracks;
}

