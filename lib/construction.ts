// 造成ゾーン、法面、擁壁のメッシュ生成
import * as THREE from 'three';
import { store } from './game';
import { getPosition, Track, TransitionCurve } from './tracks';

export type ConstructionZone = {
  id: string;
  name: string;
  trackId: string;
  offsetLeft: number;
  offsetRight: number;
  startLength: number;
  endLength: number;
  retainingWall?: RetainingWall;
  slope?: Slope;
  ground: ConstructionGround;
  /**
   * 編集時の断面プレビュー用の設定。
   * 軌道に沿って等間隔に配置する断面の分割数・高さを指定する。
   */
  crossSection?: ConstructionCrossSection;
  /**
   * 造成区間の前後（開始側・終了側）に壁を表示するか。
   * 地形の切取・盛土の端部を塞ぐ場合に使用する。
   */
  endWalls?: ConstructionEndWalls;
  /**
   * 造成形状を地形へ反映するか。既定は true。
   */
  applyToTerrain?: boolean;
};

export type ConstructionEndWalls = {
  start?: boolean;
  end?: boolean;
};

export type RetainingWall = {
  height: number;
  thickness: number;
  leftSide: boolean;
  rightSide: boolean;
  texturePath?: string;
};

export type Slope = {
  gradient: number;
  topWidth: number;
  texturePath?: string;
};

export type ConstructionGround = {
  height: number;
  isAbsolute: boolean;
};

export type ConstructionCrossSection = {
  /**
   * 軌道（造成区間）を分割する数。この数で区切った各位置に断面を配置する。
   */
  divisions: number;
  /**
   * 断面の高さ (m)。天端と法面の下端の高低差。
   */
  height: number;
};

export const CONSTRUCTION_STEP = 2;

export type ConstructionPartId =
  | 'floor'
  | 'slopeLeft'
  | 'slopeRight'
  | 'startWall'
  | 'endWall'
  | 'retainingWallLeft'
  | 'retainingWallRight'
  | 'cutSolid'
  | 'fillSolid';

export const CONSTRUCTION_PART_INFO: Record<ConstructionPartId, { label: string; color: string }> = {
  floor: { label: '線路の床', color: '#8a6a45' },
  slopeLeft: { label: '法面（左）', color: '#6f9b45' },
  slopeRight: { label: '法面（右）', color: '#5f8a3d' },
  startWall: { label: '前壁', color: '#6c8fb5' },
  endWall: { label: '後壁', color: '#8b6fb5' },
  retainingWallLeft: { label: '擁壁（左）', color: '#9a9a9a' },
  retainingWallRight: { label: '擁壁（右）', color: '#808080' },
  cutSolid: { label: '切取ソリッド（CSG用）', color: '#ff6b6b' },
  fillSolid: { label: '盛土ソリッド（CSG用）', color: '#42c9ff' },
};

export type TerrainHeightSampler = (x: number, z: number) => number | null;

export type ConstructionFrame = {
  length: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  floorY: number;
  baseY: number;
  leftFloorOffset: number;
  rightFloorOffset: number;
  leftOuterOffset: number;
  rightOuterOffset: number;
  leftOuterY: number;
  rightOuterY: number;
  leftFloor: THREE.Vector3;
  rightFloor: THREE.Vector3;
  leftOuter: THREE.Vector3;
  rightOuter: THREE.Vector3;
  points: THREE.Vector3[];
};

export type CrossSectionFrame = ConstructionFrame;

export type ConstructionMeshPart = {
  id: ConstructionPartId;
  label: string;
  color: string;
  geometry: THREE.BufferGeometry;
};

export type ConstructionSolids = {
  cut?: THREE.BufferGeometry;
  fill?: THREE.BufferGeometry;
};

function getHorizontalFrame(track: Track | TransitionCurve, length: number) {
  const up = new THREE.Vector3(0, 1, 0);
  const trackLength = Math.max(0, track.length);
  const eps = Math.min(0.5, Math.max(trackLength * 0.001, 0.05));
  const before = Math.max(0, Math.min(trackLength, length - eps));
  const after = Math.max(0, Math.min(trackLength, length + eps));

  const tangent = getPosition(track, after).sub(getPosition(track, before));
  tangent.y = 0;
  if (tangent.lengthSq() < 1e-9) tangent.set(1, 0, 0);
  tangent.normalize();

  const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
  if (right.lengthSq() < 1e-9) right.set(1, 0, 0);

  return { tangent, right };
}

export function getOffsetPoints(
  trackId: string,
  offsetLeft: number,
  offsetRight: number,
  startLength: number,
  endLength: number,
): { leftPoints: THREE.Vector3[]; rightPoints: THREE.Vector3[]; centerPoints: THREE.Vector3[] } {
  const track = store.data.tracks[trackId];
  if (!track) return { leftPoints: [], rightPoints: [], centerPoints: [] };

  const leftPoints: THREE.Vector3[] = [];
  const rightPoints: THREE.Vector3[] = [];
  const centerPoints: THREE.Vector3[] = [];

  const trackLength = Math.max(0, track.length);
  const start = Math.max(0, Math.min(startLength, endLength));
  const end = Math.min(trackLength, Math.max(startLength, endLength));
  const span = end - start;
  if (span <= 0) return { leftPoints, rightPoints, centerPoints };

  const steps = Math.max(1, Math.ceil(span / CONSTRUCTION_STEP));

  for (let i = 0; i <= steps; i++) {
    const length = start + (span * i) / steps;
    const position = getPosition(track, length);
    const { right } = getHorizontalFrame(track, length);

    centerPoints.push(position.clone());
    leftPoints.push(position.clone().add(right.clone().multiplyScalar(-offsetLeft)));
    rightPoints.push(position.clone().add(right.clone().multiplyScalar(offsetRight)));
  }

  return { leftPoints, rightPoints, centerPoints };
}

export function getGroundHeight(
  trackId: string,
  length: number,
  ground: ConstructionGround,
): number {
  const track = store.data.tracks[trackId];
  if (!track) return 0;

  if (ground.isAbsolute) return ground.height;

  const pos = getPosition(track, length);
  return pos.y + ground.height;
}

export function getCrossSection(zone: ConstructionZone): ConstructionCrossSection {
  return {
    divisions: zone.crossSection?.divisions ?? 5,
    height: zone.crossSection?.height ?? 3,
  };
}

/**
 * 断面の2D座標（x: 軌道中心からの左右方向, y: 高さ方向）を生成する。
 * 台形: 天端の幅が左/右オフセット（+天端幅）、法面勾配で下端が外側に広がる
 */
export function getCrossSectionPoints(
  zone: ConstructionZone,
  crossSection?: ConstructionCrossSection,
): THREE.Vector2[] {
  const cs = crossSection || getCrossSection(zone);
  const height = Math.max(0.1, cs.height);

  const gradient = Math.max(0.01, zone.slope?.gradient ?? 1.5);
  const topWidth = Math.max(0, zone.slope?.topWidth ?? 0);
  const leftTopX = -(zone.offsetLeft + topWidth);
  const rightTopX = zone.offsetRight + topWidth;
  const run = height * gradient;

  return [
    new THREE.Vector2(leftTopX - run, 0),
    new THREE.Vector2(leftTopX, height),
    new THREE.Vector2(rightTopX, height),
    new THREE.Vector2(rightTopX + run, 0),
  ];
}

/**
 * 軌道に沿って断面を等間隔に配置したときの、各断面の3D座標を生成する。
 * 断面は軌道（造成区間）を分割した各位置に、軌道に直交する垂直面として配置される。
 */
export function getConstructionFrames(
  track: Track | TransitionCurve,
  zone: ConstructionZone,
  crossSection?: ConstructionCrossSection,
  terrainHeightAt?: TerrainHeightSampler,
): ConstructionFrame[] {
  if (!track) return [];

  const cs = crossSection || getCrossSection(zone);
  const trackLength = Math.max(0, track.length);
  const start = Math.max(0, Math.min(zone.startLength, zone.endLength));
  const end = Math.min(trackLength, Math.max(zone.startLength, zone.endLength));
  const span = end - start;
  if (span <= 0) return [];

  const steps = Math.max(1, Math.ceil(span / CONSTRUCTION_STEP));
  const topWidth = Math.max(0, zone.slope?.topWidth ?? 0);
  const gradient = Math.max(0.01, zone.slope?.gradient ?? 1.5);
  const run = Math.max(0.1, cs.height) * gradient;

  const frames: ConstructionFrame[] = [];
  let previousLength = -Infinity;

  for (let i = 0; i <= steps; i++) {
    const length = start + (span * i) / steps;
    if (length - previousLength < 1e-6) continue;
    previousLength = length;

    const position = getPosition(track, length);
    const { tangent, right } = getHorizontalFrame(track, length);

    const floorY = zone.ground.isAbsolute ? zone.ground.height : position.y + zone.ground.height;
    const leftFloorOffset = -(zone.offsetLeft + topWidth);
    const rightFloorOffset = zone.offsetRight + topWidth;

    let leftOuterOffset = leftFloorOffset;
    let rightOuterOffset = rightFloorOffset;
    let leftOuterY = floorY;
    let rightOuterY = floorY;

    if (zone.slope) {
      leftOuterOffset = leftFloorOffset - run;
      rightOuterOffset = rightFloorOffset + run;

      const leftOuterXZ = position.clone().add(right.clone().multiplyScalar(leftOuterOffset));
      const rightOuterXZ = position.clone().add(right.clone().multiplyScalar(rightOuterOffset));

      const leftHeight = terrainHeightAt?.(leftOuterXZ.x, leftOuterXZ.z);
      const rightHeight = terrainHeightAt?.(rightOuterXZ.x, rightOuterXZ.z);

      leftOuterY = leftHeight ?? floorY - cs.height;
      rightOuterY = rightHeight ?? floorY - cs.height;
    } else {
      leftOuterOffset = leftFloorOffset;
      rightOuterOffset = rightFloorOffset;
    }

    const leftFloor = position.clone().add(right.clone().multiplyScalar(leftFloorOffset));
    const rightFloor = position.clone().add(right.clone().multiplyScalar(rightFloorOffset));
    const leftOuter = position.clone().add(right.clone().multiplyScalar(leftOuterOffset));
    const rightOuter = position.clone().add(right.clone().multiplyScalar(rightOuterOffset));

    leftFloor.y = floorY;
    rightFloor.y = floorY;
    leftOuter.y = leftOuterY;
    rightOuter.y = rightOuterY;

    frames.push({
      length,
      position: position.clone(),
      tangent: tangent.clone(),
      right: right.clone(),
      floorY,
      baseY: Math.min(floorY, leftOuterY, rightOuterY),
      leftFloorOffset,
      rightFloorOffset,
      leftOuterOffset,
      rightOuterOffset,
      leftOuterY,
      rightOuterY,
      leftFloor,
      rightFloor,
      leftOuter,
      rightOuter,
      points: [leftOuter, leftFloor, rightFloor, rightOuter],
    });
  }

  return frames;
}

export function getCrossSectionFrames(
  track: Track | TransitionCurve,
  zone: ConstructionZone,
  crossSection?: ConstructionCrossSection,
  terrainHeightAt?: TerrainHeightSampler,
): ConstructionFrame[] {
  return getConstructionFrames(track, zone, crossSection, terrainHeightAt);
}

function pushTriangle(
  positions: number[],
  uvs: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  uvA: [number, number],
  uvB: [number, number],
  uvC: [number, number],
) {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  uvs.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
}

function pushQuad(
  positions: number[],
  uvs: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
) {
  pushTriangle(positions, uvs, a, b, c, [0, 0], [1, 0], [1, 1]);
  pushTriangle(positions, uvs, a, c, d, [0, 0], [1, 1], [0, 1]);
}

export function createStripGeometry(
  frames: ConstructionFrame[],
  getLeft: (frame: ConstructionFrame) => THREE.Vector3,
  getRight: (frame: ConstructionFrame) => THREE.Vector3,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i < frames.length - 1; i++) {
    const a = getLeft(frames[i]);
    const b = getRight(frames[i]);
    const c = getRight(frames[i + 1]);
    const d = getLeft(frames[i + 1]);
    pushQuad(positions, uvs, a, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function createVerticalWallGeometry(
  frames: ConstructionFrame[],
  getLeft: (frame: ConstructionFrame) => THREE.Vector3,
  getRight: (frame: ConstructionFrame) => THREE.Vector3,
  bottomY: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i < frames.length - 1; i++) {
    const a = getLeft(frames[i]);
    const b = getRight(frames[i]);
    const c = getRight(frames[i + 1]);
    const d = getLeft(frames[i + 1]);

    const aBottom = new THREE.Vector3(a.x, bottomY, a.z);
    const bBottom = new THREE.Vector3(b.x, bottomY, b.z);
    const cBottom = new THREE.Vector3(c.x, bottomY, c.z);
    const dBottom = new THREE.Vector3(d.x, bottomY, d.z);

    pushQuad(positions, uvs, aBottom, bBottom, cBottom, dBottom);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function createEndWallGeometry(
  frame: ConstructionFrame,
  terrainHeightAt?: TerrainHeightSampler,
  fallbackBottomY: number = frame.baseY - 3,
): THREE.BufferGeometry {
  const designed = frame.points;
  const natural = designed.map(point => {
    const height = terrainHeightAt?.(point.x, point.z);
    return new THREE.Vector3(point.x, height ?? fallbackBottomY, point.z);
  });

  const positions: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i < designed.length - 1; i++) {
    pushQuad(positions, uvs, designed[i], designed[i + 1], natural[i + 1], natural[i]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 断面（左外側・左床・右床・右外側）と、下端の水平線で囲まれた端面を作る。
 */
export function createEndCapGeometry(
  frame: ConstructionFrame,
  bottomY: number,
): THREE.BufferGeometry {
  const top = frame.points;
  const bottomLeft = new THREE.Vector3(top[0].x, bottomY, top[0].z);
  const bottomRight = new THREE.Vector3(top[3].x, bottomY, top[3].z);

  const polygon = [...top, bottomRight, bottomLeft];
  const origin = frame.position;
  const axisX = frame.right.clone();
  const axisY = new THREE.Vector3(0, 1, 0);

  const points2D = polygon.map(p => new THREE.Vector2(
    p.clone().sub(origin).dot(axisX),
    p.clone().sub(origin).dot(axisY),
  ));

  const triangles = THREE.ShapeUtils.triangulateShape(points2D, []);
  const positions: number[] = [];
  const uvs: number[] = [];

  for (const triangle of triangles) {
    const a = polygon[triangle[0]];
    const b = polygon[triangle[1]];
    const c = polygon[triangle[2]];
    pushTriangle(positions, uvs, a, b, c, [0, 0], [1, 0], [1, 1]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function orientTrianglesOutward(positions: number[], uvs: number[]) {
  if (positions.length < 9) return;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  const vertexCount = positions.length / 3;
  for (let i = 0; i < positions.length; i += 3) {
    cx += positions[i];
    cy += positions[i + 1];
    cz += positions[i + 2];
  }
  cx /= vertexCount;
  cy /= vertexCount;
  cz /= vertexCount;

  const center = new THREE.Vector3(cx, cy, cz);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const triangleCenter = new THREE.Vector3();

  for (let i = 0; i < positions.length; i += 9) {
    a.set(positions[i], positions[i + 1], positions[i + 2]);
    b.set(positions[i + 3], positions[i + 4], positions[i + 5]);
    c.set(positions[i + 6], positions[i + 7], positions[i + 8]);

    normal.crossVectors(b.clone().sub(a), c.clone().sub(a));
    triangleCenter.copy(a).add(b).add(c).multiplyScalar(1 / 3);

    if (normal.dot(triangleCenter.sub(center)) < 0) {
      for (let k = 0; k < 3; k++) {
        const pi = i + 3 + k;
        const ni = i + 6 + k;
        const temp = positions[pi];
        positions[pi] = positions[ni];
        positions[ni] = temp;
      }
      const uvStart = (i / 3) * 2;
      const uvMiddle = uvStart + 2;
      const uvEnd = uvStart + 4;
      for (let k = 0; k < 2; k++) {
        const temp = uvs[uvMiddle + k];
        uvs[uvMiddle + k] = uvs[uvEnd + k];
        uvs[uvEnd + k] = temp;
      }
    }
  }
}

function createSolidGeometry(positions: number[], uvs: number[]): THREE.BufferGeometry {
  orientTrianglesOutward(positions, uvs);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function pushSolidTop(
  positions: number[],
  uvs: number[],
  frames: ConstructionFrame[],
) {
  for (let i = 0; i < frames.length - 1; i++) {
    const f0 = frames[i];
    const f1 = frames[i + 1];
    pushQuad(positions, uvs, f0.leftOuter, f0.leftFloor, f1.leftFloor, f1.leftOuter);
    pushQuad(positions, uvs, f0.leftFloor, f0.rightFloor, f1.rightFloor, f1.leftFloor);
    pushQuad(positions, uvs, f0.rightFloor, f0.rightOuter, f1.rightOuter, f1.rightFloor);
  }
}

function pushEndCapPolygon(
  positions: number[],
  uvs: number[],
  frame: ConstructionFrame,
  polygon: THREE.Vector3[],
) {
  const origin = frame.position;
  const axisX = frame.right.clone();
  const axisY = new THREE.Vector3(0, 1, 0);
  const points2D = polygon.map(p => new THREE.Vector2(
    p.clone().sub(origin).dot(axisX),
    p.clone().sub(origin).dot(axisY),
  ));
  const triangles = THREE.ShapeUtils.triangulateShape(points2D, []);
  for (const triangle of triangles) {
    pushTriangle(
      positions,
      uvs,
      polygon[triangle[0]],
      polygon[triangle[1]],
      polygon[triangle[2]],
      [0, 0],
      [1, 0],
      [1, 1],
    );
  }
}

function pushCutEndCaps(
  positions: number[],
  uvs: number[],
  frame: ConstructionFrame,
  topY: number,
) {
  const [leftOuter, leftFloor, rightFloor, rightOuter] = frame.points;
  const leftOuterTop = new THREE.Vector3(leftOuter.x, topY, leftOuter.z);
  const rightOuterTop = new THREE.Vector3(rightOuter.x, topY, rightOuter.z);
  pushEndCapPolygon(positions, uvs, frame, [
    leftOuterTop,
    rightOuterTop,
    rightOuter,
    rightFloor,
    leftFloor,
    leftOuter,
  ]);
}

function pushFillEndCaps(
  positions: number[],
  uvs: number[],
  frame: ConstructionFrame,
  bottomY: number,
) {
  const [leftOuter, leftFloor, rightFloor, rightOuter] = frame.points;
  const leftOuterBottom = new THREE.Vector3(leftOuter.x, bottomY, leftOuter.z);
  const rightOuterBottom = new THREE.Vector3(rightOuter.x, bottomY, rightOuter.z);
  pushEndCapPolygon(positions, uvs, frame, [
    leftOuter,
    leftFloor,
    rightFloor,
    rightOuter,
    rightOuterBottom,
    leftOuterBottom,
  ]);
}

export function createConstructionSolids(
  frames: ConstructionFrame[],
): ConstructionSolids {
  if (frames.length < 2) return {};

  let maxY = -Infinity;
  let minY = Infinity;
  for (const frame of frames) {
    maxY = Math.max(maxY, frame.floorY, frame.leftOuterY, frame.rightOuterY);
    minY = Math.min(minY, frame.floorY, frame.leftOuterY, frame.rightOuterY);
  }
  const topY = maxY + 100;
  const bottomY = minY - 100;

  const cutPositions: number[] = [];
  const cutUVs: number[] = [];
  pushSolidTop(cutPositions, cutUVs, frames);
  // top plane
  let previousLeft: THREE.Vector3 | null = null;
  let previousRight: THREE.Vector3 | null = null;
  for (const frame of frames) {
    const left = new THREE.Vector3(frame.leftOuter.x, topY, frame.leftOuter.z);
    const right = new THREE.Vector3(frame.rightOuter.x, topY, frame.rightOuter.z);
    if (previousLeft && previousRight)
      pushQuad(cutPositions, cutUVs, previousLeft, previousRight, right, left);
    previousLeft = left;
    previousRight = right;
  }
  // left / right side walls
  for (let i = 0; i < frames.length - 1; i++) {
    const f0 = frames[i];
    const f1 = frames[i + 1];
    const l0Top = new THREE.Vector3(f0.leftOuter.x, topY, f0.leftOuter.z);
    const l1Top = new THREE.Vector3(f1.leftOuter.x, topY, f1.leftOuter.z);
    const r0Top = new THREE.Vector3(f0.rightOuter.x, topY, f0.rightOuter.z);
    const r1Top = new THREE.Vector3(f1.rightOuter.x, topY, f1.rightOuter.z);
    pushQuad(cutPositions, cutUVs, f0.leftOuter, l0Top, l1Top, f1.leftOuter);
    pushQuad(cutPositions, cutUVs, f0.rightOuter, f1.rightOuter, r1Top, r0Top);
  }
  pushCutEndCaps(cutPositions, cutUVs, frames[0], topY);
  pushCutEndCaps(cutPositions, cutUVs, frames[frames.length - 1], topY);

  const fillPositions: number[] = [];
  const fillUVs: number[] = [];
  pushSolidTop(fillPositions, fillUVs, frames);
  previousLeft = null;
  previousRight = null;
  for (const frame of frames) {
    const left = new THREE.Vector3(frame.leftOuter.x, bottomY, frame.leftOuter.z);
    const right = new THREE.Vector3(frame.rightOuter.x, bottomY, frame.rightOuter.z);
    if (previousLeft && previousRight)
      pushQuad(fillPositions, fillUVs, previousLeft, previousRight, right, left);
    previousLeft = left;
    previousRight = right;
  }
  for (let i = 0; i < frames.length - 1; i++) {
    const f0 = frames[i];
    const f1 = frames[i + 1];
    const l0Bottom = new THREE.Vector3(f0.leftOuter.x, bottomY, f0.leftOuter.z);
    const l1Bottom = new THREE.Vector3(f1.leftOuter.x, bottomY, f1.leftOuter.z);
    const r0Bottom = new THREE.Vector3(f0.rightOuter.x, bottomY, f0.rightOuter.z);
    const r1Bottom = new THREE.Vector3(f1.rightOuter.x, bottomY, f1.rightOuter.z);
    pushQuad(fillPositions, fillUVs, f0.leftOuter, f1.leftOuter, l1Bottom, l0Bottom);
    pushQuad(fillPositions, fillUVs, f0.rightOuter, r0Bottom, r1Bottom, f1.rightOuter);
  }
  pushFillEndCaps(fillPositions, fillUVs, frames[0], bottomY);
  pushFillEndCaps(fillPositions, fillUVs, frames[frames.length - 1], bottomY);

  const fill = createSolidGeometry(fillPositions, fillUVs);
  // 切取側の床と完全に一致してZファイティングしないよう、盛土側をわずかに下げる
  fill.translate(0, -0.05, 0);

  return {
    cut: createSolidGeometry(cutPositions, cutUVs),
    fill,
  };
}

export function createRetainingWallMesh(
  points: THREE.Vector3[],
  height: number,
  thickness: number,
  outwardSign: number = 1,
): THREE.BufferGeometry {
  if (points.length < 2) return new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    const nextI = Math.min(i + 1, points.length - 1);
    const prevI = Math.max(i - 1, 0);

    let tangent: THREE.Vector3;
    if (i === 0) {
      tangent = points[nextI].clone().sub(p).normalize();
    } else if (i === points.length - 1) {
      tangent = p.clone().sub(points[prevI]).normalize();
    } else {
      tangent = points[nextI].clone().sub(points[prevI]).normalize();
    }

    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(outwardSign);

    if (side.length() < 0.001) {
      side.set(1, 0, 0).multiplyScalar(outwardSign);
    }

    const baseBottom = p.clone();
    const baseTop = p.clone().add(new THREE.Vector3(0, height, 0));
    const outerBottom = baseBottom.clone().add(side.clone().multiplyScalar(thickness));
    const outerTop = baseTop.clone().add(side.clone().multiplyScalar(thickness));

    const vi = i * 8;

    positions.push(
      baseBottom.x, baseBottom.y, baseBottom.z,
      baseTop.x, baseTop.y, baseTop.z,
      outerTop.x, outerTop.y, outerTop.z,
      outerBottom.x, outerBottom.y, outerBottom.z,
    );
    const frontNormal = side.clone();
    normals.push(
      frontNormal.x, frontNormal.y, frontNormal.z,
      frontNormal.x, frontNormal.y, frontNormal.z,
      frontNormal.x, frontNormal.y, frontNormal.z,
      frontNormal.x, frontNormal.y, frontNormal.z,
    );
    uvs.push(0, 0, 0, 1, 1, 1, 1, 0);

    positions.push(
      outerBottom.x, outerBottom.y, outerBottom.z,
      outerTop.x, outerTop.y, outerTop.z,
      baseTop.x, baseTop.y, baseTop.z,
      baseBottom.x, baseBottom.y, baseBottom.z,
    );
    const backNormal = side.clone().negate();
    normals.push(
      backNormal.x, backNormal.y, backNormal.z,
      backNormal.x, backNormal.y, backNormal.z,
      backNormal.x, backNormal.y, backNormal.z,
      backNormal.x, backNormal.y, backNormal.z,
    );
    uvs.push(0, 0, 0, 1, 1, 1, 1, 0);

    if (i < points.length - 1) {
      const base = vi;
      const next = (i + 1) * 8;
      indices.push(base, base + 1, next + 1, base, next + 1, next);
      indices.push(base + 2, base + 3, next + 3, base + 2, next + 3, next + 2);
      indices.push(base + 4, base + 5, next + 5, base + 4, next + 5, next + 4);
      indices.push(base + 6, base + 7, next + 7, base + 6, next + 7, next + 6);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function createSlopeMesh(
  topPoints: THREE.Vector3[],
  bottomHeight: number | ((point: THREE.Vector3, index: number) => number),
  gradient: number,
): THREE.BufferGeometry {
  if (topPoints.length < 2) return new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < topPoints.length; i++) {
    const topP = topPoints[i];
    const bottomY = typeof bottomHeight === "number" ? bottomHeight : bottomHeight(topP, i);
    const dropHeight = topP.y - bottomY;
    const horizontalRun = dropHeight * gradient;

    const nextI = Math.min(i + 1, topPoints.length - 1);
    const prevI = Math.max(i - 1, 0);

    let tangent: THREE.Vector3;
    if (i === 0) {
      tangent = topPoints[nextI].clone().sub(topP).normalize();
    } else if (i === topPoints.length - 1) {
      tangent = topP.clone().sub(topPoints[prevI]).normalize();
    } else {
      tangent = topPoints[nextI].clone().sub(topPoints[prevI]).normalize();
    }

    const outward = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
    if (outward.length() < 0.001) {
      outward.set(1, 0, 0);
    }

    const bottomP = topP.clone()
      .add(outward.clone().multiplyScalar(horizontalRun))
      .setY(bottomY);

    const vi = i * 6;

    positions.push(
      topP.x, topP.y, topP.z,
      bottomP.x, bottomP.y, bottomP.z,
    );

    const slopeNormal = new THREE.Vector3()
      .crossVectors(
        bottomP.clone().sub(topP).normalize(),
        tangent,
      ).normalize();
    normals.push(
      slopeNormal.x, slopeNormal.y, slopeNormal.z,
      slopeNormal.x, slopeNormal.y, slopeNormal.z,
    );

    const v = i / Math.max(topPoints.length - 1, 1);
    uvs.push(0, v, 1, v);

    if (i < topPoints.length - 1) {
      const next = (i + 1) * 6;
      indices.push(vi, vi + 1, next + 1, vi, next + 1, next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function createGroundMesh(
  leftPoints: THREE.Vector3[],
  rightPoints: THREE.Vector3[],
  height: number | ((point: THREE.Vector3, index: number) => number),
): THREE.BufferGeometry {
  if (leftPoints.length < 2 || rightPoints.length < 2) return new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const count = Math.min(leftPoints.length, rightPoints.length);

  for (let i = 0; i < count; i++) {
    const leftHeight = typeof height === "number" ? height : height(leftPoints[i], i);
    const rightHeight = typeof height === "number" ? height : height(rightPoints[i], i);
    const leftP = leftPoints[i].clone().setY(leftHeight);
    const rightP = rightPoints[i].clone().setY(rightHeight);

    const vi = i * 6;

    positions.push(
      leftP.x, leftP.y, leftP.z,
      rightP.x, rightP.y, rightP.z,
    );
    normals.push(0, 1, 0, 0, 1, 0);

    const v = i / Math.max(count - 1, 1);
    uvs.push(0, v, 1, v);

    if (i < count - 1) {
      const next = (i + 1) * 6;
      indices.push(vi, vi + 1, next + 1, vi, next + 1, next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function createConstructionLandscapeParts(
  zone: ConstructionZone,
  frames: ConstructionFrame[],
  terrainHeightAt?: TerrainHeightSampler,
): ConstructionMeshPart[] {
  if (frames.length < 2) return [];

  const parts: ConstructionMeshPart[] = [];

  if (zone.slope) {
    parts.push({
      id: 'slopeLeft',
      ...CONSTRUCTION_PART_INFO.slopeLeft,
      geometry: createStripGeometry(frames, f => f.leftOuter, f => f.leftFloor),
    });
    parts.push({
      id: 'slopeRight',
      ...CONSTRUCTION_PART_INFO.slopeRight,
      geometry: createStripGeometry(frames, f => f.rightFloor, f => f.rightOuter),
    });
  }

  parts.push({
    id: 'floor',
    ...CONSTRUCTION_PART_INFO.floor,
    geometry: createStripGeometry(frames, f => f.leftFloor, f => f.rightFloor),
  });

  if (zone.retainingWall?.leftSide) {
    parts.push({
      id: 'retainingWallLeft',
      ...CONSTRUCTION_PART_INFO.retainingWallLeft,
      geometry: createRetainingWallMesh(
        frames.map(f => f.leftFloor),
        zone.retainingWall.height,
        zone.retainingWall.thickness,
        -1,
      ),
    });
  }

  if (zone.retainingWall?.rightSide) {
    parts.push({
      id: 'retainingWallRight',
      ...CONSTRUCTION_PART_INFO.retainingWallRight,
      geometry: createRetainingWallMesh(
        frames.map(f => f.rightFloor),
        zone.retainingWall.height,
        zone.retainingWall.thickness,
        1,
      ),
    });
  }

  const wallDepth = Math.max(1, zone.crossSection?.height ?? 3, zone.retainingWall?.height ?? 0);

  if (zone.endWalls?.start) {
    parts.push({
      id: 'startWall',
      ...CONSTRUCTION_PART_INFO.startWall,
      geometry: createEndWallGeometry(frames[0], terrainHeightAt, frames[0].baseY - wallDepth),
    });
  }

  if (zone.endWalls?.end) {
    const frame = frames[frames.length - 1];
    parts.push({
      id: 'endWall',
      ...CONSTRUCTION_PART_INFO.endWall,
      geometry: createEndWallGeometry(frame, terrainHeightAt, frame.baseY - wallDepth),
    });
  }

  return parts;
}

export function createCSGCutBrush(
  leftPoints: THREE.Vector3[],
  rightPoints: THREE.Vector3[],
  centerPoints: THREE.Vector3[],
  groundHeight: number,
  extraHeight: number = 50,
): THREE.BufferGeometry {
  const allPoints: THREE.Vector3[] = [];

  for (const p of leftPoints) {
    allPoints.push(new THREE.Vector3(p.x, groundHeight + extraHeight, p.z));
  }
  for (const p of [...rightPoints].reverse()) {
    allPoints.push(new THREE.Vector3(p.x, groundHeight + extraHeight, p.z));
  }

  if (allPoints.length < 3) return new THREE.BufferGeometry();

  const shape = new THREE.Shape();
  shape.moveTo(allPoints[0].x, allPoints[0].z);
  for (let i = 1; i < allPoints.length; i++) {
    shape.lineTo(allPoints[i].x, allPoints[i].z);
  }
  shape.closePath();

  const extrudeSettings = {
    depth: extraHeight * 2,
    bevelEnabled: false,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  geometry.rotateX(-Math.PI / 2);
  geometry.scale(1, 1, -1);
  geometry.translate(0, groundHeight - extraHeight, 0);

  return geometry;
}

export function getConstructionZoneBounds(zoneId: string) {
  const zone = store.data.constructionZones?.[zoneId];
  if (!zone) return null;

  const { leftPoints, rightPoints, centerPoints } = getOffsetPoints(
    zone.trackId, zone.offsetLeft, zone.offsetRight, zone.startLength, zone.endLength,
  );

  const groundHeight = getGroundHeight(zone.trackId, (zone.startLength + zone.endLength) / 2, zone.ground);

  return { leftPoints, rightPoints, centerPoints, groundHeight, zone };
}
