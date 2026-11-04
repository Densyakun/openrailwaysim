// OSM の LineString から、直線・緩和曲線・円曲線で構成される軌道を作成する
import * as THREE from "three";
import type { Position } from "geojson";
import { deserialize, trackTypeId } from "../lib/game";
import {
  applyTransitionCurveToSerializableTrack, connectTwoTracks, createTransitionCurve,
  getPosition, getTransitionCurveData,
} from "../lib/tracks";
import type { SerializableTrack, Track, TrackModel, TransitionCurve } from "../lib/tracks";
import { getRelativePosition } from "../lib/gis";

export type LineAlignmentOptions = {
  originCoordinate: Position;
  designSpeedKmh: number;
  gaugeMm: number;
  trackModels: TrackModel[];
  idPrefix: string;
  /** これより緩い曲線は直線として扱う（半径 m） */
  maxCurveRadius?: number;
  /** 円曲線半径の下限（m） */
  minCurveRadius?: number;
  minCurveLength?: number;
  /** これより短い円曲線は直線として扱う（m） */
  minCurveArcLength?: number;
  resampleInterval?: number;
  closed?: boolean;
};

export type LineAlignmentResult = {
  tracks: { [trackId: string]: SerializableTrack };
  trackIds: string[];
  curveCount: number;
};

type Vec2 = { x: number; z: number };

type Line = {
  point: Vec2;
  dir: Vec2;
};

type CurveInterval = {
  start: number;
  end: number;
  sign: number;
};

type Kinematics = {
  distances: number[];
  headings: number[];
  curvatures: number[];
};

type CurvePlan = {
  interval: CurveInterval;
  lineIn: Line;
  lineOut: Line;
  pi: Vec2;
  deflection: number;
  isRight: boolean;
  fittedRadius: number;
  radius: number;
  transitionLength: number;
  tangentLength: number;
  ts: Vec2;
  st: Vec2;
};

const PI = Math.PI;

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

function mul(a: Vec2, scalar: number): Vec2 {
  return { x: a.x * scalar, z: a.z * scalar };
}

function dot(a: Vec2, b: Vec2) {
  return a.x * b.x + a.z * b.z;
}

function cross(a: Vec2, b: Vec2) {
  return a.x * b.z - a.z * b.x;
}

function length(a: Vec2) {
  return Math.hypot(a.x, a.z);
}

function distance(a: Vec2, b: Vec2) {
  return length(sub(a, b));
}

function normalize(a: Vec2): Vec2 {
  const len = length(a);
  return len < 1e-9 ? { x: 0, z: 0 } : { x: a.x / len, z: a.z / len };
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function headingToDirection(heading: number): Vec2 {
  return { x: Math.cos(heading), z: -Math.sin(heading) };
}

function directionToHeading(direction: Vec2) {
  return Math.atan2(-direction.z, direction.x);
}

function unwrapHeading(previous: number, current: number) {
  let value = current;
  while (value - previous > PI) value -= PI * 2;
  while (value - previous < -PI) value += PI * 2;
  return value;
}

function projectPolyline(coordinates: Position[], originCoordinate: Position): Vec2[] {
  return coordinates.map(coordinate => {
    const position = getRelativePosition(coordinate, originCoordinate);
    return { x: position.x, z: position.z };
  });
}

function resamplePolyline(points: Vec2[], interval: number): Vec2[] {
  if (points.length < 2) return [...points];

  const result: Vec2[] = [points[0]];
  let carry = 0;

  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const segmentLength = distance(a, b);
    if (segmentLength < 1e-6) continue;

    let positionOnSegment = 0;

    while (carry + (segmentLength - positionOnSegment) >= interval) {
      const step = interval - carry;
      positionOnSegment += step;
      result.push(lerp(a, b, positionOnSegment / segmentLength));
      carry = 0;
    }

    carry += segmentLength - positionOnSegment;
  }

  const last = points[points.length - 1];
  if (distance(result[result.length - 1], last) > 1e-3)
    result.push(last);

  return result;
}

function computeKinematics(points: Vec2[], interval: number): Kinematics {
  const count = points.length;
  const distances = new Array<number>(count).fill(0);

  for (let index = 1; index < count; index++)
    distances[index] = distances[index - 1] + distance(points[index - 1], points[index]);

  const headingWindow = Math.max(1, Math.round(8 / interval));
  const headings = new Array<number>(count).fill(0);

  for (let index = 0; index < count; index++) {
    const start = Math.max(0, index - headingWindow);
    const end = Math.min(count - 1, index + headingWindow);
    headings[index] = directionToHeading(sub(points[end], points[start]));
  }

  for (let index = 1; index < count; index++)
    headings[index] = unwrapHeading(headings[index - 1], headings[index]);

  const curvatureWindow = Math.max(1, Math.round(12 / interval));
  const rawCurvatures = new Array<number>(count).fill(0);

  for (let index = 0; index < count; index++) {
    const start = Math.max(0, index - curvatureWindow);
    const end = Math.min(count - 1, index + curvatureWindow);
    const distance_ = distances[end] - distances[start];
    rawCurvatures[index] = distance_ > 1e-6
      ? (headings[end] - headings[start]) / distance_
      : 0;
  }

  const smoothingRadius = 2;
  const curvatures = rawCurvatures.map((_, index) => {
    let sum = 0;
    let count_ = 0;
    for (let offset = -smoothingRadius; offset <= smoothingRadius; offset++) {
      const target = index + offset;
      if (target < 0 || count <= target) continue;
      sum += rawCurvatures[target];
      count_++;
    }
    return count_ ? sum / count_ : 0;
  });

  return { distances, headings, curvatures };
}

function detectCurveIntervals(
  kinematics: Kinematics,
  options: Required<Pick<LineAlignmentOptions, "resampleInterval" | "maxCurveRadius" | "minCurveLength">>,
): CurveInterval[] {
  const threshold = 1 / options.maxCurveRadius;
  const flags = kinematics.curvatures.map(curvature => Math.abs(curvature) > threshold);
  const rawIntervals: CurveInterval[] = [];

  let index = 0;
  while (index < flags.length) {
    if (!flags[index]) {
      index++;
      continue;
    }

    let end = index;
    let sum = 0;
    while (end < flags.length && flags[end]) {
      sum += kinematics.curvatures[end];
      end++;
    }

    rawIntervals.push({
      start: index,
      end: end - 1,
      sign: Math.sign(sum),
    });
    index = end;
  }

  const mergeGap = Math.max(1, Math.round(40 / options.resampleInterval));
  const merged: CurveInterval[] = [];

  rawIntervals.forEach(interval => {
    const previous = merged[merged.length - 1];
    if (
      previous
      && interval.start - previous.end <= mergeGap
      && Math.sign(interval.sign) === Math.sign(previous.sign)
    ) {
      previous.end = interval.end;
      previous.sign = Math.sign(previous.sign + interval.sign);
    } else {
      merged.push({ ...interval });
    }
  });

  return merged.filter(interval => {
    const runLength = kinematics.distances[interval.end] - kinematics.distances[interval.start];
    if (runLength < options.minCurveLength) return false;

    const deflection = Math.abs(kinematics.headings[interval.end] - kinematics.headings[interval.start]);
    return 0.5 * PI / 180 < deflection;
  });
}

function rotateClosedPolyline(points: Vec2[], kinematics: Kinematics, intervals: CurveInterval[]): Vec2[] {
  if (intervals.length === 0) return points;

  const count = points.length;
  const uniqueCount = count - 1;
  if (uniqueCount < 2) return points;

  const gaps: { start: number; end: number; size: number }[] = [];

  intervals.forEach((interval, index) => {
    const next = intervals[(index + 1) % intervals.length];
    const start = interval.end;
    const end = index === intervals.length - 1 ? next.start + uniqueCount : next.start;
    gaps.push({ start, end, size: end - start });
  });

  const longest = gaps.sort((a, b) => b.size - a.size)[0];
  if (!longest) return points;

  const cut = Math.floor(((longest.start + longest.end) / 2) % uniqueCount);
  if (cut === 0) return points;

  const base = points.slice(0, uniqueCount);
  const rotated = [...base.slice(cut), ...base.slice(0, cut)];
  rotated.push(rotated[0]);
  return rotated;
}

function fitLine(points: Vec2[]): Line | null {
  if (points.length < 2) return null;

  let centerX = 0;
  let centerZ = 0;
  points.forEach(point => {
    centerX += point.x;
    centerZ += point.z;
  });
  centerX /= points.length;
  centerZ /= points.length;

  let xx = 0;
  let xz = 0;
  let zz = 0;

  points.forEach(point => {
    const x = point.x - centerX;
    const z = point.z - centerZ;
    xx += x * x;
    xz += x * z;
    zz += z * z;
  });

  const theta = 0.5 * Math.atan2(2 * xz, xx - zz);
  let direction = { x: Math.cos(theta), z: Math.sin(theta) };

  const travel = sub(points[points.length - 1], points[0]);
  if (dot(direction, travel) < 0)
    direction = mul(direction, -1);

  if (length(direction) < 1e-6) return null;

  return {
    point: { x: centerX, z: centerZ },
    dir: normalize(direction),
  };
}

function lineFromHeading(point: Vec2, heading: number): Line {
  return { point, dir: headingToDirection(heading) };
}

function projectPointOntoLine(point: Vec2, line: Line): Vec2 {
  return add(line.point, mul(line.dir, dot(sub(point, line.point), line.dir)));
}

function intersectLines(a: Line, b: Line): Vec2 | null {
  const denominator = cross(a.dir, b.dir);
  if (Math.abs(denominator) < 1e-8) return null;

  const t = cross(sub(b.point, a.point), b.dir) / denominator;
  if (!Number.isFinite(t)) return null;

  return add(a.point, mul(a.dir, t));
}

function fitCircle(points: Vec2[]): { center: Vec2; radius: number } | null {
  if (points.length < 3) return null;

  let sumX = 0;
  let sumZ = 0;
  let sumXX = 0;
  let sumXZ = 0;
  let sumZZ = 0;
  let sumXXX = 0;
  let sumXZZ = 0;
  let sumXXZ = 0;
  let sumZZZ = 0;

  points.forEach(point => {
    const x = point.x;
    const z = point.z;
    sumX += x;
    sumZ += z;
    sumXX += x * x;
    sumXZ += x * z;
    sumZZ += z * z;
    sumXXX += x * x * x;
    sumXZZ += x * z * z;
    sumXXZ += x * x * z;
    sumZZZ += z * z * z;
  });

  const count = points.length;
  const a11 = sumXX;
  const a12 = sumXZ;
  const a13 = sumX;
  const a21 = sumXZ;
  const a22 = sumZZ;
  const a23 = sumZ;
  const a31 = sumX;
  const a32 = sumZ;
  const a33 = count;

  const b1 = -(sumXXX + sumXZZ);
  const b2 = -(sumXXZ + sumZZZ);
  const b3 = -(sumXX + sumZZ);

  const determinant =
    a11 * (a22 * a33 - a23 * a32)
    - a12 * (a21 * a33 - a23 * a31)
    + a13 * (a21 * a32 - a22 * a31);

  if (Math.abs(determinant) < 1e-9) return null;

  const solve = (replace: number) => {
    const matrix = [
      [a11, a12, a13],
      [a21, a22, a23],
      [a31, a32, a33],
    ];
    const values = [b1, b2, b3];
    matrix.forEach((row, index) => {
      row[replace] = values[index];
    });

    const det =
      matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
      - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
      + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);

    return det / determinant;
  };

  const d = solve(0);
  const e = solve(1);
  const f = solve(2);
  const centerX = -d / 2;
  const centerZ = -e / 2;

  const radius = Math.sqrt(Math.max(0, centerX * centerX + centerZ * centerZ - f));
  if (!Number.isFinite(radius) || radius <= 0) return null;

  return {
    center: { x: centerX, z: centerZ },
    radius,
  };
}

/**
 * 緩和曲線長を求める。
 * 在来線の一般的な計算（カントによる3点支持・乗り心地・カント不足の変化）を使用する。
 */
export function calculateTransitionLength(designSpeedKmh: number, radius: number, gaugeMm: number) {
  if (!Number.isFinite(radius) || radius <= 0) return 0;

  const speed = Math.max(0, designSpeedKmh);
  const standardGauge = gaugeMm >= 1435;
  const cantConstant = standardGauge ? 11.3 : 8.4;
  const maxCant = 0.105;
  const cant = Math.min(maxCant, Math.max(0, cantConstant * speed * speed / radius / 1000));
  const cantDeficiency = standardGauge ? 0.050 : 0.070;

  const l1 = 300 * cant;
  const l2 = (standardGauge ? 7.4 : 10.0) * cant * speed;
  const l3 = (standardGauge ? 6.7 : 9.0) * cantDeficiency * speed;

  return clamp(Math.max(10, l1, l2, l3), 10, 200);
}

function tangentLength(radius: number, transitionLength: number, deflection: number) {
  const shift = transitionLength ** 2 / (24 * radius)
    - transitionLength ** 4 / (2688 * radius ** 3);
  return (radius + shift) * Math.tan(Math.abs(deflection) / 2) + transitionLength / 2;
}

/**
 * 実際に作成する緩和曲線・円曲線の数値積分結果から接線長を求める。
 * 級数近似の誤差で軌道の接続点がずれるのを防ぐ。
 */
function actualTangentLength(
  radius: number,
  transitionLength: number,
  deflection: number,
  isRight: boolean,
) {
  const deflectionAbs = Math.abs(deflection);
  const sign = isRight ? -1 : 1;
  const curvature = sign / radius;
  const first = getTransitionCurveData(0, curvature, transitionLength);
  const circularAngle = deflectionAbs - 2 * Math.abs(first.endRotationY);

  if (circularAngle < 0) return null;

  const circularLength = radius * circularAngle;
  const circular = {
    position: first.endPosition.clone(),
    rotationY: first.endRotationY,
    length: circularLength,
    radius: isRight ? radius : -radius,
    gradients: { 0: 0 },
    trackModels: [],
  } as unknown as Track;
  const circularEnd = getPosition(circular, circularLength);
  const secondStartHeading = first.endRotationY + sign * circularLength / radius;
  const second = getTransitionCurveData(curvature, 0, transitionLength);

  const cos = Math.cos(secondStartHeading);
  const sin = Math.sin(secondStartHeading);
  const endX = circularEnd.x + second.endPosition.x * cos + second.endPosition.z * sin;
  const endZ = circularEnd.z - second.endPosition.x * sin + second.endPosition.z * cos;
  const endHeading = secondStartHeading + second.endRotationY;

  const direction = { x: Math.cos(endHeading), z: -Math.sin(endHeading) };
  const denominator = direction.z;
  if (Math.abs(denominator) < 1e-9) return null;

  const t = (endX * direction.z - endZ * direction.x) / denominator;
  return Number.isFinite(t) && t > 0 ? t : null;
}

function solveCurve(
  fittedRadius: number,
  designSpeedKmh: number,
  gaugeMm: number,
  deflection: number,
  tangentLimit: number,
  minRadius: number,
) {
  const deflectionAbs = Math.abs(deflection);
  if (deflectionAbs < 1e-5 || tangentLimit <= 0) return null;

  const nominalTransition = calculateTransitionLength(designSpeedKmh, fittedRadius, gaugeMm);
  let radius = clamp(fittedRadius, minRadius, 20000);
  let transitionLength = Math.min(nominalTransition, 0.8 * radius * deflectionAbs);
  let tangent = tangentLength(radius, transitionLength, deflectionAbs);

  for (let iteration = 0; iteration < 60 && tangent > tangentLimit; iteration++) {
    if (transitionLength > 1) {
      transitionLength *= 0.7;
    } else {
      radius *= 0.9;
      if (radius < minRadius) break;
    }

    transitionLength = Math.min(transitionLength, 0.8 * radius * deflectionAbs);
    tangent = tangentLength(radius, transitionLength, deflectionAbs);
  }

  if (tangent > tangentLimit) {
    transitionLength = 0;
    radius = tangentLimit / Math.tan(deflectionAbs / 2);
    tangent = tangentLength(radius, transitionLength, deflectionAbs);
  }

  if (!Number.isFinite(radius) || radius < minRadius || !Number.isFinite(tangent) || tangent <= 0)
    return null;

  return { radius, transitionLength, tangent };
}

function fitCurveToTangent(
  fittedRadius: number,
  designSpeedKmh: number,
  gaugeMm: number,
  deflection: number,
  targetTangent: number,
  minRadius: number,
) {
  const deflectionAbs = Math.abs(deflection);
  if (deflectionAbs < 1e-5 || targetTangent <= 0) return null;

  const nominalTransition = calculateTransitionLength(designSpeedKmh, fittedRadius, gaugeMm);
  let radius = clamp(fittedRadius, minRadius, 20000);
  let transitionLength = Math.min(nominalTransition, 0.8 * radius * deflectionAbs);
  let tangent = tangentLength(radius, transitionLength, deflectionAbs);

  for (let iteration = 0; iteration < 80 && Math.abs(tangent - targetTangent) > 0.02; iteration++) {
    if (tangent > targetTangent) {
      if (transitionLength > 1)
        transitionLength *= 0.85;
      else
        radius *= 0.95;
    } else {
      transitionLength = Math.min(nominalTransition, transitionLength * 1.05 + 0.1);
      if (transitionLength >= nominalTransition)
        radius *= 1.02;
    }

    if (radius < minRadius) radius = minRadius;
    if (radius > 20000) radius = 20000;
    transitionLength = Math.min(transitionLength, 0.8 * radius * deflectionAbs);
    tangent = tangentLength(radius, transitionLength, deflectionAbs);
  }

  if (!Number.isFinite(radius) || !Number.isFinite(tangent) || tangent <= 0)
    return null;

  return { radius, transitionLength, tangent };
}

function fitCurveToActualTangent(
  fittedRadius: number,
  designSpeedKmh: number,
  gaugeMm: number,
  deflection: number,
  isRight: boolean,
  targetTangent: number,
  minRadius: number,
) {
  const deflectionAbs = Math.abs(deflection);
  if (deflectionAbs < 1e-5 || targetTangent <= 0.1) return null;

  const nominalTransition = calculateTransitionLength(designSpeedKmh, fittedRadius, gaugeMm);
  let radius = clamp(fittedRadius, minRadius, 20000);
  let transitionLength = Math.min(nominalTransition, 0.8 * radius * deflectionAbs);
  let tangent = actualTangentLength(radius, transitionLength, deflection, isRight)
    ?? tangentLength(radius, transitionLength, deflectionAbs);

  for (let iteration = 0; iteration < 80 && Math.abs(tangent - targetTangent) > 0.02; iteration++) {
    if (tangent > targetTangent) {
      if (transitionLength > 1)
        transitionLength *= 0.85;
      else
        radius *= 0.95;
    } else {
      transitionLength = Math.min(nominalTransition, transitionLength * 1.05 + 0.1);
      if (transitionLength >= nominalTransition)
        radius *= 1.02;
    }

    radius = clamp(radius, minRadius, 20000);
    transitionLength = Math.min(transitionLength, 0.8 * radius * deflectionAbs);
    tangent = actualTangentLength(radius, transitionLength, deflection, isRight)
      ?? tangentLength(radius, transitionLength, deflectionAbs);
  }

  if (!Number.isFinite(radius) || !Number.isFinite(tangent) || tangent <= 0) {
    const fallbackRadius = targetTangent / Math.tan(deflectionAbs / 2);
    if (!Number.isFinite(fallbackRadius) || fallbackRadius <= 0) return null;
    return { radius: fallbackRadius, transitionLength: 0, tangent: targetTangent };
  }

  return { radius, transitionLength, tangent };
}

function createStraightTrack(
  position: Vec2,
  direction: Vec2,
  trackLength: number,
  trackModels: TrackModel[],
): SerializableTrack {
  return {
    position: [position.x, 0, position.z],
    rotationY: directionToHeading(direction),
    length: trackLength,
    radius: 0,
    gradients: { 0: 0 },
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: 0,
    endCant: 0,
    trackModels,
  };
}

function createCircularTrack(
  position: Vec2,
  heading: number,
  trackLength: number,
  radius: number,
  trackModels: TrackModel[],
): SerializableTrack {
  return {
    position: [position.x, 0, position.z],
    rotationY: heading,
    length: trackLength,
    radius,
    gradients: { 0: 0 },
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: 0,
    endCant: 0,
    trackModels,
  };
}

function roundNumber(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roundTrack(track: SerializableTrack): SerializableTrack {
  const result = { ...track } as SerializableTrack & {
    endPosition?: [number, number, number];
    endRotationY?: number;
    beginCurvature?: number;
    endCurvature?: number;
    transitionCurves?: { position: [number, number, number]; rotationY: number; curvature: number }[];
  };

  result.position = result.position.map(value => roundNumber(value, 3)) as [number, number, number];
  result.length = roundNumber(result.length, 3);
  result.radius = roundNumber(result.radius, 3);
  result.rotationY = roundNumber(result.rotationY, 6);

  if (result.endPosition)
    result.endPosition = result.endPosition.map(value => roundNumber(value, 3)) as [number, number, number];
  if (typeof result.endRotationY === "number")
    result.endRotationY = roundNumber(result.endRotationY, 6);
  if (typeof result.beginCurvature === "number")
    result.beginCurvature = roundNumber(result.beginCurvature, 8);
  if (typeof result.endCurvature === "number")
    result.endCurvature = roundNumber(result.endCurvature, 8);
  if (result.transitionCurves)
    result.transitionCurves = result.transitionCurves.map(transition => ({
      position: transition.position.map(value => roundNumber(value, 3)) as [number, number, number],
      rotationY: roundNumber(transition.rotationY, 6),
      curvature: roundNumber(transition.curvature, 8),
    }));

  return result;
}

function getTrackEnd(track: SerializableTrack) {
  const deserialized = deserialize(trackTypeId, track) as Track;
  const position = getPosition(deserialized, deserialized.length);
  return {
    position: { x: position.x, z: position.z },
    heading: getHeadingAt(deserialized, deserialized.length),
  };
}

function getHeadingAt(track: Track, trackLength: number) {
  const transition = track as Track & {
    endPosition?: THREE.Vector3;
    endRotationY?: number;
    curveDirection?: boolean;
  };

  if (transition.endPosition !== undefined && typeof transition.endRotationY === "number")
    return track.rotationY + (transition.curveDirection ? 1 : -1) * transition.endRotationY;

  if (track.radius !== 0)
    return track.rotationY + trackLength / -track.radius;

  return track.rotationY;
}

function createTransitionToCurve(
  position: Vec2,
  heading: number,
  transitionLength: number,
  radius: number,
  isRight: boolean,
  trackModels: TrackModel[],
) {
  return createTransitionCurve(
    [position.x, 0, position.z],
    heading,
    transitionLength,
    radius,
    isRight,
    trackModels,
  );
}

function createCurveToTransition(
  position: Vec2,
  heading: number,
  transitionLength: number,
  radius: number,
  isRight: boolean,
  trackModels: TrackModel[],
) {
  const transitionData = getTransitionCurveData(
    isRight ? -1 / radius : 1 / radius,
    0,
    transitionLength,
  );

  const track: SerializableTrack = {
    position: [position.x, 0, position.z],
    rotationY: heading,
    length: transitionLength,
    radius: 0,
    gradients: { 0: 0 },
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCant: 0,
    endCant: 0,
    trackModels,
  };

  return applyTransitionCurveToSerializableTrack(track, {
    ...transitionData,
    curveDirection: true,
  } as TransitionCurve) as SerializableTrack;
}

function fitLines(points: Vec2[], kinematics: Kinematics, intervals: CurveInterval[], closed: boolean) {
  const lines: (Line | null)[] = [];
  const spans: Vec2[][] = [];

  for (let index = 0; index <= intervals.length; index++) {
    const start = index === 0 ? 0 : intervals[index - 1].end;
    const end = index === intervals.length ? points.length - 1 : intervals[index].start;
    const span = points.slice(start, Math.max(start + 1, end + 1));
    spans.push(span);
  }

  if (closed && 1 < spans.length) {
    const combined = [...spans[spans.length - 1], ...spans[0]];
    const line = fitLine(combined);
    lines.push(line);
    for (let index = 1; index < spans.length - 1; index++)
      lines.push(fitLine(spans[index]));
    lines.push(line);
    return lines;
  }

  spans.forEach((span, index) => {
    const line = fitLine(span);
    if (line) {
      lines.push(line);
      return;
    }

    const start = span[0] ?? points[0];
    const end = span[span.length - 1] ?? start;
    const midpoint = lerp(start, end, 0.5);
    const heading = kinematics.headings[
      index === 0 ? 0 : index === spans.length - 1 ? points.length - 1 : Math.floor((points.length - 1) / 2)
    ];
    lines.push(lineFromHeading(midpoint, heading));
  });

  return lines;
}

function removeUnusableIntervals(
  points: Vec2[],
  kinematics: Kinematics,
  intervals: CurveInterval[],
  closed: boolean,
) {
  let current = [...intervals];

  for (let attempt = 0; attempt < intervals.length + 4; attempt++) {
    const lines = fitLines(points, kinematics, current, closed);
    let badIndex = -1;

    for (let index = 0; index < current.length; index++) {
      const lineIn = lines[index];
      const lineOut = lines[index + 1];
      if (!lineIn || !lineOut) {
        badIndex = index;
        break;
      }

      const intersection = intersectLines(lineIn, lineOut);
      if (!intersection) {
        badIndex = index;
        break;
      }

      const deflection = Math.atan2(-cross(lineIn.dir, lineOut.dir), dot(lineIn.dir, lineOut.dir));
      if (Math.abs(deflection) < 0.5 * PI / 180) {
        badIndex = index;
        break;
      }
    }

    if (badIndex === -1) return current;
    current.splice(badIndex, 1);
    if (current.length === 0) return current;
  }

  return current;
}

function buildCurvePlans(
  points: Vec2[],
  kinematics: Kinematics,
  intervals: CurveInterval[],
  lines: Line[],
  options: Required<Pick<LineAlignmentOptions, "designSpeedKmh" | "gaugeMm" | "minCurveRadius" | "closed">>,
): (CurvePlan | null)[] {
  return intervals.map((interval, index) => {
    const lineIn = lines[index];
    const lineOut = lines[index + 1];
    if (!lineIn || !lineOut) return null;

    const pi = intersectLines(lineIn, lineOut);
    if (!pi) return null;

    const deflection = Math.atan2(-cross(lineIn.dir, lineOut.dir), dot(lineIn.dir, lineOut.dir));
    if (Math.abs(deflection) < 0.5 * PI / 180) return null;

    const circle = fitCircle(points.slice(interval.start, interval.end + 1));
    const averageCurvature = Math.abs(
      kinematics.curvatures
        .slice(interval.start, interval.end + 1)
        .reduce((sum, curvature) => sum + Math.abs(curvature), 0)
        / Math.max(1, interval.end - interval.start + 1),
    );
    const fittedRadius = circle?.radius ?? (averageCurvature > 1e-8 ? 1 / averageCurvature : 1000);

    return {
      interval,
      lineIn,
      lineOut,
      pi,
      deflection,
      isRight: deflection < 0,
      fittedRadius: clamp(fittedRadius, options.minCurveRadius, 20000),
      radius: 0,
      transitionLength: 0,
      tangentLength: 0,
      ts: pi,
      st: pi,
    };
  });
}

function buildPlansForIntervals(
  points: Vec2[],
  kinematics: Kinematics,
  intervals: CurveInterval[],
  closed: boolean,
  minCurveArcLength: number,
  options: Required<Pick<LineAlignmentOptions, "designSpeedKmh" | "gaugeMm" | "minCurveRadius" | "closed">>,
) {
  let lines = fitLines(points, kinematics, intervals, closed) as Line[];
  let built = buildCurvePlans(points, kinematics, intervals, lines, options);

  for (let attempt = 0; attempt < intervals.length + 4; attempt++) {
    const badIndex = built.findIndex(plan =>
      plan === null || Math.abs(plan.deflection) * plan.fittedRadius < minCurveArcLength
    );

    if (badIndex === -1) break;

    intervals.splice(badIndex, 1);
    if (!intervals.length)
      return { lines: [] as Line[], plans: [] as CurvePlan[] };

    lines = fitLines(points, kinematics, intervals, closed) as Line[];
    built = buildCurvePlans(points, kinematics, intervals, lines, options);
  }

  return {
    lines,
    plans: built.filter((plan): plan is CurvePlan => plan !== null),
  };
}

function computeLineDistances(
  plans: CurvePlan[],
  lines: Line[],
  startPoint: Vec2,
  endPoint: Vec2,
  closed: boolean,
) {
  const lineDistances: number[] = [];

  for (let index = 0; index <= plans.length; index++) {
    if (index === 0) {
      const startProjection = projectPointOntoLine(startPoint, lines[0]);
      lineDistances.push(Math.max(0, dot(sub(plans[0].pi, startProjection), lines[0].dir)));
    } else if (index === plans.length) {
      const endProjection = closed ? projectPointOntoLine(startPoint, lines[index]) : projectPointOntoLine(endPoint, lines[index]);
      lineDistances.push(Math.max(0, dot(sub(endProjection, plans[plans.length - 1].pi), lines[index].dir)));
    } else {
      lineDistances.push(Math.max(0, dot(sub(plans[index].pi, plans[index - 1].pi), lines[index].dir)));
    }
  }

  return lineDistances;
}

function applyTangentLimits(
  plans: CurvePlan[],
  lines: Line[],
  startPoint: Vec2,
  endPoint: Vec2,
  closed: boolean,
  options: Required<Pick<LineAlignmentOptions, "designSpeedKmh" | "gaugeMm" | "minCurveRadius">>,
) {
  if (plans.length === 0) return;

  const lineDistances = computeLineDistances(plans, lines, startPoint, endPoint, closed);

  plans.forEach((plan, index) => {
    const left = lineDistances[index];
    const right = lineDistances[index + 1];
    const edge = index === 0 || index === plans.length - 1;
    const limit = Math.min(left, right) * (edge ? 0.9 : 0.49);
    const solved = solveCurve(
      plan.fittedRadius,
      options.designSpeedKmh,
      options.gaugeMm,
      plan.deflection,
      limit,
      options.minCurveRadius,
    );

    if (solved) {
      plan.radius = solved.radius;
      plan.transitionLength = solved.transitionLength;
      plan.tangentLength = solved.tangent;
    } else {
      plan.radius = plan.fittedRadius;
      plan.transitionLength = 0;
      plan.tangentLength = Math.min(limit, tangentLength(plan.radius, 0, plan.deflection));
    }
  });

  for (let iteration = 0; iteration < 3; iteration++) {
    for (let index = 1; index < plans.length; index++) {
      const available = lineDistances[index];
      const total = plans[index - 1].tangentLength + plans[index].tangentLength;
      if (total <= available * 0.98) continue;

      const target = available * 0.98 / total;
      plans[index - 1].tangentLength *= target;
      plans[index].tangentLength *= target;

      const left = fitCurveToTangent(
        plans[index - 1].fittedRadius,
        options.designSpeedKmh,
        options.gaugeMm,
        plans[index - 1].deflection,
        plans[index - 1].tangentLength,
        options.minCurveRadius,
      );
      const right = fitCurveToTangent(
        plans[index].fittedRadius,
        options.designSpeedKmh,
        options.gaugeMm,
        plans[index].deflection,
        plans[index].tangentLength,
        options.minCurveRadius,
      );

      if (left) {
        plans[index - 1].radius = left.radius;
        plans[index - 1].transitionLength = left.transitionLength;
        plans[index - 1].tangentLength = left.tangent;
      }

      if (right) {
        plans[index].radius = right.radius;
        plans[index].transitionLength = right.transitionLength;
        plans[index].tangentLength = right.tangent;
      }
    }

    if (plans.length > 0) {
      if (plans[0].tangentLength > lineDistances[0] * 0.9) {
        const solved = fitCurveToTangent(
          plans[0].fittedRadius,
          options.designSpeedKmh,
          options.gaugeMm,
          plans[0].deflection,
          lineDistances[0] * 0.9,
          options.minCurveRadius,
        );
        if (solved) {
          plans[0].radius = solved.radius;
          plans[0].transitionLength = solved.transitionLength;
          plans[0].tangentLength = solved.tangent;
        }
      }

      const lastIndex = plans.length - 1;
      if (plans[lastIndex].tangentLength > lineDistances[lastIndex + 1] * 0.9) {
        const solved = fitCurveToTangent(
          plans[lastIndex].fittedRadius,
          options.designSpeedKmh,
          options.gaugeMm,
          plans[lastIndex].deflection,
          lineDistances[lastIndex + 1] * 0.9,
          options.minCurveRadius,
        );
        if (solved) {
          plans[lastIndex].radius = solved.radius;
          plans[lastIndex].transitionLength = solved.transitionLength;
          plans[lastIndex].tangentLength = solved.tangent;
        }
      }
    }
  }

  const refreshTangents = () => {
    plans.forEach(plan => {
      const actual = actualTangentLength(
        plan.radius,
        plan.transitionLength,
        plan.deflection,
        plan.isRight,
      );

      if (actual !== null)
        plan.tangentLength = actual;

      plan.ts = sub(plan.pi, mul(plan.lineIn.dir, plan.tangentLength));
      plan.st = add(plan.pi, mul(plan.lineOut.dir, plan.tangentLength));
    });
  };

  refreshTangents();

  for (let iteration = 0; iteration < 5; iteration++) {
    let changed = false;

    for (let index = 1; index < plans.length; index++) {
      const available = lineDistances[index];
      const total = plans[index - 1].tangentLength + plans[index].tangentLength;
      if (total <= available * 0.98) continue;

      const target = available * 0.49;
      const left = fitCurveToActualTangent(
        plans[index - 1].fittedRadius,
        options.designSpeedKmh,
        options.gaugeMm,
        plans[index - 1].deflection,
        plans[index - 1].isRight,
        target,
        options.minCurveRadius,
      );
      const right = fitCurveToActualTangent(
        plans[index].fittedRadius,
        options.designSpeedKmh,
        options.gaugeMm,
        plans[index].deflection,
        plans[index].isRight,
        target,
        options.minCurveRadius,
      );

      if (left) {
        plans[index - 1].radius = left.radius;
        plans[index - 1].transitionLength = left.transitionLength;
        plans[index - 1].tangentLength = left.tangent;
        changed = true;
      }

      if (right) {
        plans[index].radius = right.radius;
        plans[index].transitionLength = right.transitionLength;
        plans[index].tangentLength = right.tangent;
        changed = true;
      }
    }

    if (plans.length > 0) {
      if (plans[0].tangentLength > lineDistances[0] * 0.9) {
        const solved = fitCurveToActualTangent(
          plans[0].fittedRadius,
          options.designSpeedKmh,
          options.gaugeMm,
          plans[0].deflection,
          plans[0].isRight,
          lineDistances[0] * 0.9,
          options.minCurveRadius,
        );
        if (solved) {
          plans[0].radius = solved.radius;
          plans[0].transitionLength = solved.transitionLength;
          plans[0].tangentLength = solved.tangent;
          changed = true;
        }
      }

      const lastIndex = plans.length - 1;
      if (plans[lastIndex].tangentLength > lineDistances[lastIndex + 1] * 0.9) {
        const solved = fitCurveToActualTangent(
          plans[lastIndex].fittedRadius,
          options.designSpeedKmh,
          options.gaugeMm,
          plans[lastIndex].deflection,
          plans[lastIndex].isRight,
          lineDistances[lastIndex + 1] * 0.9,
          options.minCurveRadius,
        );
        if (solved) {
          plans[lastIndex].radius = solved.radius;
          plans[lastIndex].transitionLength = solved.transitionLength;
          plans[lastIndex].tangentLength = solved.tangent;
          changed = true;
        }
      }
    }

    refreshTangents();
    if (!changed) break;
  }
}

export function createAlignmentFromLineString(
  coordinates: Position[],
  options: LineAlignmentOptions,
): LineAlignmentResult {
  const interval = options.resampleInterval ?? 2;
  const maxCurveRadius = options.maxCurveRadius ?? 2500;
  const minCurveRadius = options.minCurveRadius ?? 40;
  const minCurveLength = options.minCurveLength ?? 25;
  const closed = options.closed ?? false;

  const projected = projectPolyline(coordinates, options.originCoordinate);
  let points = resamplePolyline(projected, interval);
  if (points.length < 2) return { tracks: {}, trackIds: [], curveCount: 0 };

  let kinematics = computeKinematics(points, interval);
  let intervals = detectCurveIntervals(kinematics, {
    resampleInterval: interval,
    maxCurveRadius,
    minCurveLength,
  });

  if (closed && 2 < points.length) {
    points = rotateClosedPolyline(points, kinematics, intervals);
    kinematics = computeKinematics(points, interval);
    intervals = detectCurveIntervals(kinematics, {
      resampleInterval: interval,
      maxCurveRadius,
      minCurveLength,
    });
  }

    intervals = removeUnusableIntervals(points, kinematics, intervals, closed);

  const minCurveArcLength = options.minCurveArcLength ?? 20;
  const startPoint = points[0];
  const endPoint = closed ? startPoint : points[points.length - 1];
  const planOptions = {
    designSpeedKmh: options.designSpeedKmh,
    gaugeMm: options.gaugeMm,
    minCurveRadius,
    closed,
  };

  let built = buildPlansForIntervals(
    points,
    kinematics,
    intervals,
    closed,
    minCurveArcLength,
    planOptions,
  );
  let lines = built.lines;
  let finalPlans = built.plans;

  for (let attempt = 0; attempt < intervals.length + 4; attempt++) {
    if (closed && lines.length) lines[lines.length - 1] = lines[0];

    applyTangentLimits(finalPlans, lines, startPoint, endPoint, closed, planOptions);

    const lineDistances = computeLineDistances(finalPlans, lines, startPoint, endPoint, closed);
    let removeIndex = -1;

    for (let index = 1; index < finalPlans.length; index++) {
      const available = lineDistances[index];
      const total = finalPlans[index - 1].tangentLength + finalPlans[index].tangentLength;

      if (available < 2 || total > available + 1) {
        const leftArc = Math.abs(finalPlans[index - 1].deflection) * finalPlans[index - 1].fittedRadius;
        const rightArc = Math.abs(finalPlans[index].deflection) * finalPlans[index].fittedRadius;
        removeIndex = leftArc <= rightArc ? index - 1 : index;
        break;
      }
    }

    if (removeIndex === -1) break;

    intervals.splice(removeIndex, 1);
    if (!intervals.length) {
      finalPlans = [];
      lines = [];
      break;
    }

    built = buildPlansForIntervals(
      points,
      kinematics,
      intervals,
      closed,
      minCurveArcLength,
      planOptions,
    );
    lines = built.lines;
    finalPlans = built.plans;
  }

  const tracks: { [trackId: string]: SerializableTrack } = {};
  const trackIds: string[] = [];
  let previousId = "";

  const addTrack = (track: SerializableTrack) => {
    const trackId = `${options.idPrefix}-track-${trackIds.length}`;
    if (previousId)
      connectTwoTracks(tracks[previousId], previousId, true, track, trackId, false);
    tracks[trackId] = track;
    trackIds.push(trackId);
    previousId = trackId;
  };

  const startProjection = projectPointOntoLine(startPoint, lines[0]);

  if (finalPlans.length === 0) {
    const direction = normalize(sub(endPoint, startPoint));
    const trackLength = distance(startPoint, endPoint);
    if (trackLength > 0.01)
      addTrack(createStraightTrack(startPoint, direction, trackLength, options.trackModels));
  } else {
    const firstStraightLength = dot(sub(finalPlans[0].ts, startProjection), lines[0].dir);
    if (firstStraightLength > 0.01)
      addTrack(createStraightTrack(startProjection, lines[0].dir, firstStraightLength, options.trackModels));

    let lastTransitionEnd = { position: finalPlans[0].st, heading: 0 };

    finalPlans.forEach((plan, index) => {
      const transition1 = createTransitionToCurve(
        plan.ts,
        directionToHeading(plan.lineIn.dir),
        plan.transitionLength,
        plan.radius,
        plan.isRight,
        options.trackModels,
      );
      addTrack(transition1);

      const transitionEnd = getTrackEnd(transition1);
      const circularAngle = Math.abs(plan.deflection) - plan.transitionLength / plan.radius;
      const circularLength = plan.radius * circularAngle;
      const circularRadius = plan.isRight ? plan.radius : -plan.radius;
      const circular = createCircularTrack(
        transitionEnd.position,
        transitionEnd.heading,
        Math.max(0.01, circularLength),
        circularRadius,
        options.trackModels,
      );
      addTrack(circular);

      const circularEnd = getTrackEnd(circular);
      const transition2 = createCurveToTransition(
        circularEnd.position,
        circularEnd.heading,
        plan.transitionLength,
        plan.radius,
        plan.isRight,
        options.trackModels,
      );
      addTrack(transition2);

      const transition2End = getTrackEnd(transition2);
      lastTransitionEnd = transition2End;

      if (index < finalPlans.length - 1) {
        const next = finalPlans[index + 1];
        const straightLength = dot(sub(next.ts, transition2End.position), lines[index + 1].dir);
        if (straightLength > 0.01)
          addTrack(createStraightTrack(transition2End.position, lines[index + 1].dir, straightLength, options.trackModels));
      }
    });

    const endProjection = closed ? startProjection : projectPointOntoLine(endPoint, lines[lines.length - 1]);
    const lastStraightLength = dot(sub(endProjection, lastTransitionEnd.position), lines[lines.length - 1].dir);
    if (lastStraightLength > 0.01)
      addTrack(createStraightTrack(lastTransitionEnd.position, lines[lines.length - 1].dir, lastStraightLength, options.trackModels));
  }

  if (closed && 1 < trackIds.length)
    connectTwoTracks(tracks[trackIds[trackIds.length - 1]], trackIds[trackIds.length - 1], true, tracks[trackIds[0]], trackIds[0], false);

  const roundedTracks = Object.fromEntries(
    Object.entries(tracks).map(([trackId, track]) => [trackId, roundTrack(track)]),
  );

  return {
    tracks: roundedTracks,
    trackIds,
    curveCount: finalPlans.length,
  };
}

