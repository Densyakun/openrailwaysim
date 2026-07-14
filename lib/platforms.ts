// プラットフォーム（ホーム）のデータモデルとジオメトリ生成
import * as THREE from 'three';
import { store } from './game';
import { getPosition, getRotation, Track, TrackShape } from './tracks';

/**
 * プラットフォーム（島）の定義
 */
export type Platform = {
  id: string;
  name: string;
  /** 線路上の開始位置 */
  startLength: number;
  /** 線路上の終了位置 */
  endLength: number;
  /** 境界線からのオフセット（線路から離れる方向が正） */
  offset: number;
  /** ホーム高さ（線路の高さからの相対値、または絶対値） */
  height: number;
  /** 高さが絶対値かどうか */
  isAbsoluteHeight: boolean;
  /** 軌道オフセット敷設時の車両偏倚量（曲線部） */
  vehicleOverhang: number;
  /** 使用する線路ID（複数線路をまたぐ島の場合） */
  trackIds: string[];
  /** 境界線の顶点（CADモードで指定） */
  boundaryVertices: BoundaryVertex[];
  /** 色 */
  color: string;
  /** ブーリアン演算で使用する島のIDリスト */
  booleanIslandIds: string[];
};

/**
 * 境界線の頂点
 */
export type BoundaryVertex = {
  /** 線路上の距離（0〜1で正規化、または絶対距離） */
  lengthRatio: number;
  /** 線路からのオフセット */
  offset: number;
  /** 使用する線路ID */
  trackId: string;
};

/**
 * 3Dモデルをワールド上に配置するための定義
 */
export type WorldModel = {
  id: string;
  name: string;
  /** モデルファイルパス */
  modelPath: string;
  /** ワールド上の位置 */
  position: THREE.Vector3;
  /** 回転 */
  rotation: THREE.Euler;
  /** スケール */
  scale: THREE.Vector3;
};

/**
 * 線路上の指定範囲のオフセットポイントを取得する
 */
export function getPlatformOffsetPoints(
  trackId: string,
  startLength: number,
  endLength: number,
  offset: number,
  vehicleOverhang: number = 0,
  steps: number = 20,
): { leftPoints: THREE.Vector3[]; rightPoints: THREE.Vector3[] } {
  const track = store.data.tracks[trackId];
  if (!track) return { leftPoints: [], rightPoints: [] };

  const leftPoints: THREE.Vector3[] = [];
  const rightPoints: THREE.Vector3[] = [];

  const length = endLength - startLength;

  for (let i = 0; i <= steps; i++) {
    const l = startLength + (length * i) / steps;
    const pos = getPosition(track, l);
    const rot = getRotation(track, l);

    const right = new THREE.Vector3(1, 0, 0).applyEuler(rot).normalize();

    // 軌道オフセット敷設機能と同様に、曲線部で車両偏倚量を加算
    const radius = track.radius;
    let curveOffset = 0;
    if (radius !== 0) {
      // 曲線部では車両偏倚量を考慮
      curveOffset = vehicleOverhang * (1 - Math.abs(pos.x) / Math.abs(radius));
    }

    const totalOffset = offset + curveOffset;

    leftPoints.push(pos.clone().add(right.clone().multiplyScalar(-totalOffset)));
    rightPoints.push(pos.clone().add(right.clone().multiplyScalar(totalOffset)));
  }

  return { leftPoints, rightPoints };
}

/**
 * 境界線からプラットフォームのポリゴンを生成する
 */
export function createPlatformPolygon(
  platform: Platform,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  if (platform.boundaryVertices.length > 0) {
    // CADモード：境界線の頂点を使用
    for (const vertex of platform.boundaryVertices) {
      const track = store.data.tracks[vertex.trackId];
      if (!track) continue;

      const pos = getPosition(track, vertex.lengthRatio * track.length);
      const rot = getRotation(track, vertex.lengthRatio * track.length);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(rot).normalize();

      points.push(pos.clone().add(right.clone().multiplyScalar(vertex.offset)));
    }
  } else if (platform.trackIds.length > 0) {
    // シンプルモード：線路に沿ったオフセット
    for (const trackId of platform.trackIds) {
      const { leftPoints } = getPlatformOffsetPoints(
        trackId,
        platform.startLength,
        platform.endLength,
        platform.offset,
        platform.vehicleOverhang,
      );
      points.push(...leftPoints);
    }
  }

  return points;
}

/**
 * プラットフォームのメッシュを生成する
 */
export function createPlatformMesh(
  platform: Platform,
): THREE.BufferGeometry {
  const polygon = createPlatformPolygon(platform);
  if (polygon.length < 3) return new THREE.BufferGeometry();

  const height = platform.isAbsoluteHeight
    ? platform.height
    : getPlatformBaseHeight(platform) + platform.height;

  // 2D Shapeを作成（XY平面で作成してから回転）
  const shape = new THREE.Shape();
  shape.moveTo(polygon[0].x, polygon[0].z);
  for (let i = 1; i < polygon.length; i++) {
    shape.lineTo(polygon[i].x, polygon[i].z);
  }
  shape.closePath();

  const extrudeSettings = {
    depth: 0.3, // ホームの厚み
    bevelEnabled: false,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // XY平面からXZ平面に回転し、高さを設定
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height, 0);

  return geometry;
}

/**
 * プラットフォームのベース高さを取得する
 */
function getPlatformBaseHeight(platform: Platform): number {
  if (platform.trackIds.length === 0) return 0;

  const trackId = platform.trackIds[0];
  const track = store.data.tracks[trackId];
  if (!track) return 0;

  const midLength = (platform.startLength + platform.endLength) / 2;
  const pos = getPosition(track, midLength);
  return pos.y;
}

/**
 * プラットフォームの境界線を描画するポイントを取得する
 */
export function getPlatformBoundaryPoints(
  platform: Platform,
): THREE.Vector3[] {
  return createPlatformPolygon(platform);
}

/**
 * プラットフォームの面積を概算する
 */
export function estimatePlatformArea(platform: Platform): number {
  const polygon = createPlatformPolygon(platform);
  if (polygon.length < 3) return 0;

  // Shoelace formula for 2D area (using x and z coordinates)
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].z;
    area -= polygon[j].x * polygon[i].z;
  }
  return Math.abs(area) / 2;
}

/**
 * 複数のプラットフォームをブーリアン演算で結合する
 * 注：現在は単純な結合のみ対応
 */
export function mergePlatforms(
  platforms: Platform[],
): THREE.Vector3[] {
  const allPoints: THREE.Vector3[] = [];

  for (const platform of platforms) {
    const polygon = createPlatformPolygon(platform);
    allPoints.push(...polygon);
  }

  // 凸包を計算して結合
  return computeConvexHull(allPoints);
}

/**
 * 凸包を計算する（Andrew's monotone chain algorithm）
 */
function computeConvexHull(points: THREE.Vector3[]): THREE.Vector3[] {
  if (points.length < 3) return points;

  // XZ平面で凸包を計算
  const sorted = points
    .map(p => ({ x: p.x, z: p.z, y: p.y }))
    .sort((a, b) => a.x - b.x || a.z - b.z);

  const cross = (o: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

  const lower: typeof sorted = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: typeof sorted = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));

  // 元の高さを復元
  return hull.map(h => {
    const original = points.find(p => Math.abs(p.x - h.x) < 0.001 && Math.abs(p.z - h.z) < 0.001);
    return new THREE.Vector3(h.x, original?.y ?? 0, h.z);
  });
}
