// 造成ゾーン、法面、擁壁のメッシュ生成
import * as THREE from 'three';
import { store } from './game';
import { getPosition, getRotation, Track, TransitionCurve } from './tracks';

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

  const length = endLength - startLength;
  const steps = Math.max(2, Math.ceil(length / CONSTRUCTION_STEP));

  for (let i = 0; i <= steps; i++) {
    const l = startLength + (length * i) / steps;
    const pos = getPosition(track, l);
    const rot = getRotation(track, l);

    const right = new THREE.Vector3(1, 0, 0).applyEuler(rot).normalize();

    centerPoints.push(pos.clone());
    leftPoints.push(pos.clone().add(right.clone().multiplyScalar(-offsetLeft)));
    rightPoints.push(pos.clone().add(right.clone().multiplyScalar(offsetRight)));
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

  // 台形
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

export type CrossSectionFrame = {
  length: number;
  position: THREE.Vector3;
  right: THREE.Vector3;
  baseY: number;
  points: THREE.Vector3[];
};

/**
 * 軌道に沿って断面を等間隔に配置したときの、各断面の3D座標を生成する。
 * 断面は軌道（造成区間）を divisions 分割した各位置に、
 * 軌道に直交する垂直面として配置される。天端（断面の上端）は造成地面の高さに合わせる。
 */
export function getCrossSectionFrames(
  track: Track | TransitionCurve,
  zone: ConstructionZone,
  crossSection?: ConstructionCrossSection,
): CrossSectionFrame[] {
  const cs = crossSection || getCrossSection(zone);
  const points2D = getCrossSectionPoints(zone, cs);

  const start = Math.min(zone.startLength, zone.endLength);
  const end = Math.max(zone.startLength, zone.endLength);
  const span = end - start;
  const divisions = Math.max(1, Math.round(cs.divisions));
  const trackLength = Math.max(0, track.length);

  const up = new THREE.Vector3(0, 1, 0);
  const frames: CrossSectionFrame[] = [];

  for (let i = 0; i <= divisions; i++) {
    const t = divisions === 0 ? 0 : i / divisions;
    const length = Math.min(Math.max(0, start + span * t), trackLength);
    const position = getPosition(track, length);

    // 水平な接線方向（勾配を無視して平面状の軌道方向を求める）
    const eps = Math.min(0.5, Math.max(trackLength * 0.001, 0.05));
    const lBefore = Math.max(0, length - eps);
    const lAfter = Math.min(trackLength, length + eps);
    const tangent = getPosition(track, lAfter).sub(getPosition(track, lBefore));
    tangent.y = 0;
    if (tangent.lengthSq() < 1e-9) tangent.set(1, 0, 0);
    tangent.normalize();

    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // 造成地面（断面の上端）の高さ。法面の下端はそこから断面の高さ分だけ下げる
    const groundY = zone.ground.isAbsolute ? zone.ground.height : position.y + zone.ground.height;
    const baseY = groundY - cs.height;

    const points = points2D.map(p =>
      position.clone()
        .add(right.clone().multiplyScalar(p.x))
        .add(new THREE.Vector3(0, baseY + p.y, 0)),
    );

    frames.push({ length, position: position.clone(), right: right.clone(), baseY, points });
  }

  return frames;
}

export function createRetainingWallMesh(
  points: THREE.Vector3[],
  height: number,
  thickness: number,
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
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

    if (side.length() < 0.001) {
      side.set(1, 0, 0);
    }

    const baseBottom = p.clone();
    const baseTop = p.clone().add(new THREE.Vector3(0, height, 0));
    const outerBottom = baseBottom.clone().add(side.clone().multiplyScalar(thickness));
    const outerTop = baseTop.clone().add(side.clone().multiplyScalar(thickness));

    const vi = i * 8;

    // Front face (side facing outward)
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

    // Back face
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

    // Indices for quads (2 triangles each)
    if (i < points.length - 1) {
      const base = vi;
      const next = (i + 1) * 8;
      // Front face quad
      indices.push(base, base + 1, next + 1, base, next + 1, next);
      indices.push(base + 2, base + 3, next + 3, base + 2, next + 3, next + 2);
      // Back face quad
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
  bottomHeight: number,
  gradient: number,
): THREE.BufferGeometry {
  if (topPoints.length < 2) return new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < topPoints.length; i++) {
    const topP = topPoints[i];
    const dropHeight = topP.y - bottomHeight;
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
      .setY(bottomHeight);

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
  height: number,
): THREE.BufferGeometry {
  if (leftPoints.length < 2 || rightPoints.length < 2) return new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const count = Math.min(leftPoints.length, rightPoints.length);

  for (let i = 0; i < count; i++) {
    const leftP = leftPoints[i].clone().setY(height);
    const rightP = rightPoints[i].clone().setY(height);

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

export function createCSGCutBrush(
  leftPoints: THREE.Vector3[],
  rightPoints: THREE.Vector3[],
  centerPoints: THREE.Vector3[],
  groundHeight: number,
  extraHeight: number = 50,
): THREE.BufferGeometry {
  const allPoints: THREE.Vector3[] = [];

  // Build a closed footprint: left side forward, right side backward
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

  // Rotate from XY to XZ plane and translate
  geometry.rotateX(-Math.PI / 2);
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
