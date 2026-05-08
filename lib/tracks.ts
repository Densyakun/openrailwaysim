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

export function getPosition(track: TrackShape, length: number): THREE.Vector3 {
  const { position, rotationY, radius, length: curveLength, gradients } = track;

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
        gradients: { 0: 0 },
      },
      length - i * curveLength / (track as TransitionCurve).transitionCurves.length
    ).applyEuler(rotation).add(cV(position))
      .add(new THREE.Vector3(0, getHeight(length, gradients)));
  }

  if (radius === 0)
    return cV(position).add(new THREE.Vector3(1).applyEuler(rotation).multiplyScalar(length))
      .add(new THREE.Vector3(0, getHeight(length, gradients)));
  else
    return cV(position)
      .add(new THREE.Vector3(0, 0, radius).applyEuler(rotation))
      .add(new THREE.Vector3(0, 0, -radius).applyEuler(new THREE.Euler(0, length / -radius + rotationY)))
      .add(new THREE.Vector3(0, getHeight(length, gradients)));
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

export const TOLERANCE_FOR_TRACK_CONNECTIONS = 0.1;

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