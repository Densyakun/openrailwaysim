import * as THREE from 'three'
import { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon, Position } from 'geojson'
import { getRelativePosition } from './gis'

export type BuildingSourceEntry = {
  id: string;
  value: FeatureCollection;
}

export type BuildingGeometryData = {
  wallPositions: Float32Array;
  wallNormals: Float32Array;
  wallUvs: Float32Array;
  wallColors: Float32Array;
  roofPositions: Float32Array;
  roofNormals: Float32Array;
  roofUvs: Float32Array;
  roofColors: Float32Array;
  buildingCount: number;
}

type BuildingGeometryBuilder = {
  wallPositions: number[];
  wallNormals: number[];
  wallUvs: number[];
  wallColors: number[];
  roofPositions: number[];
  roofNormals: number[];
  roofUvs: number[];
  roofColors: number[];
  buildingCount: number;
}

/** 生成設定を変更したときにキャッシュを無効化するためのバージョン。 */
export const buildingGenerationVersion = 1

export const buildingFloorHeight = 3
const facadeModuleWidth = 4
const roofModuleSize = 4
const maximumBuildingHeight = 300
const minimumBuildingHeight = 2

const defaultHeightByType: { [key: string]: number } = {
  house: 7,
  detached: 7,
  residential: 12,
  apartments: 12,
  terrace: 8,
  commercial: 10,
  retail: 8,
  industrial: 9,
  warehouse: 8,
  garage: 3,
  garages: 3,
  shed: 3,
  hut: 3,
  roof: 3,
  church: 15,
  cathedral: 25,
  chapel: 10,
  school: 10,
  university: 14,
  college: 12,
  hospital: 18,
  hotel: 20,
  office: 20,
  service: 5,
  barn: 7,
  farm: 7,
  train_station: 10,
  transportation: 8,
  parking: 3,
  yes: 8,
}

const colorPalette: { [key: string]: [number, number, number] } = {
  residential: [0.84, 0.81, 0.74],
  apartments: [0.8, 0.79, 0.75],
  house: [0.87, 0.8, 0.7],
  detached: [0.87, 0.8, 0.7],
  commercial: [0.72, 0.77, 0.83],
  retail: [0.78, 0.79, 0.84],
  office: [0.7, 0.76, 0.84],
  industrial: [0.76, 0.77, 0.75],
  warehouse: [0.73, 0.75, 0.74],
  church: [0.88, 0.85, 0.74],
  school: [0.82, 0.82, 0.76],
  hospital: [0.86, 0.87, 0.86],
  hotel: [0.8, 0.78, 0.75],
  yes: [0.82, 0.8, 0.76],
}

function parseNumericTag(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getBuildingHeights(
  properties: GeoJsonProperties,
  floorHeight = buildingFloorHeight,
): { base: number; top: number } {
  const type = String(properties?.building ?? properties?.['building:part'] ?? 'yes');
  const levels = parseNumericTag(properties?.['building:levels']);
  const minLevels = parseNumericTag(properties?.['min_level']);
  const defaultHeight = defaultHeightByType[type] ?? defaultHeightByType.yes;

  const base = Math.max(0, parseNumericTag(properties?.min_height) ?? (minLevels !== undefined ? minLevels * floorHeight : 0));
  const rawTop = parseNumericTag(properties?.height) ?? (levels !== undefined ? levels * floorHeight : defaultHeight);

  const minimumTop = base + minimumBuildingHeight;
  const top = Math.min(base + maximumBuildingHeight, Math.max(minimumTop, rawTop));

  return { base, top };
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getBuildingColor(
  properties: GeoJsonProperties,
  id: string,
): [number, number, number] {
  const type = String(properties?.building ?? properties?.['building:part'] ?? 'yes');
  const base = colorPalette[type] ?? colorPalette.yes;
  const variation = ((hashString(id) % 21) - 10) / 200;

  return [
    Math.min(1, Math.max(0, base[0] + variation)),
    Math.min(1, Math.max(0, base[1] + variation)),
    Math.min(1, Math.max(0, base[2] + variation)),
  ];
}

export function isBuildingFeature(feature: Feature) {
  const building = feature.properties?.building;
  const buildingPart = feature.properties?.['building:part'];

  if (building === 'no') return false;
  return typeof building === 'string' || typeof buildingPart === 'string';
}

function toOpenRing(coordinates: Position[], originCoordinate: Position) {
  const points: THREE.Vector2[] = [];

  coordinates.forEach(coordinate => {
    const position = getRelativePosition(coordinate, originCoordinate);
    const point = new THREE.Vector2(position.x, position.z);

    if (!points.length || points[points.length - 1].distanceTo(point) > 0.001)
      points.push(point);
  });

  if (points.length > 1 && points[0].distanceTo(points[points.length - 1]) <= 0.001)
    points.pop();

  return points;
}

function signedArea(points: THREE.Vector2[]) {
  let area = 0;

  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    area += point.x * next.y - next.x * point.y;
  }

  return area / 2;
}

function ensureOrientation(points: THREE.Vector2[], counterClockwise: boolean) {
  if ((signedArea(points) > 0) !== counterClockwise) points.reverse();
}

function pushWall(
  data: BuildingGeometryBuilder,
  ring: THREE.Vector2[],
  base: number,
  top: number,
  color: [number, number, number],
  floorHeight: number,
) {
  if (ring.length < 3) return;

  const counterClockwise = signedArea(ring) > 0;
  let distance = 0;

  const pushVertex = (point: THREE.Vector3, normal: THREE.Vector3, u: number, v: number) => {
    data.wallPositions.push(point.x, point.y, point.z);
    data.wallNormals.push(normal.x, normal.y, normal.z);
    data.wallUvs.push(u, v);
    data.wallColors.push(color[0], color[1], color[2]);
  };

  for (let index = 0; index < ring.length; index++) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const deltaX = next.x - current.x;
    const deltaZ = next.y - current.y;
    const length = Math.hypot(deltaX, deltaZ);

    if (length < 0.001) continue;

    // 外周は CCW、穴は CW に正規化しているため、リングの内側に対して外向きの法線になる
    const normalX = counterClockwise ? deltaZ / length : -deltaZ / length;
    const normalZ = counterClockwise ? -deltaX / length : deltaX / length;
    const normal = new THREE.Vector3(normalX, 0, normalZ);

    const p0 = new THREE.Vector3(current.x, base, current.y);
    const p1 = new THREE.Vector3(next.x, base, next.y);
    const p2 = new THREE.Vector3(next.x, top, next.y);
    const p3 = new THREE.Vector3(current.x, top, current.y);

    const u0 = distance / facadeModuleWidth;
    const u1 = (distance + length) / facadeModuleWidth;
    const v0 = base / floorHeight;
    const v1 = top / floorHeight;

    const cross = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));

    if (cross.dot(normal) < 0) {
      pushVertex(p0, normal, u0, v0);
      pushVertex(p2, normal, u1, v1);
      pushVertex(p1, normal, u1, v0);
      pushVertex(p0, normal, u0, v0);
      pushVertex(p3, normal, u0, v1);
      pushVertex(p2, normal, u1, v1);
    } else {
      pushVertex(p0, normal, u0, v0);
      pushVertex(p1, normal, u1, v0);
      pushVertex(p2, normal, u1, v1);
      pushVertex(p0, normal, u0, v0);
      pushVertex(p2, normal, u1, v1);
      pushVertex(p3, normal, u0, v1);
    }

    distance += length;
  }
}

function pushRoof(
  data: BuildingGeometryBuilder,
  outer: THREE.Vector2[],
  holes: THREE.Vector2[][],
  top: number,
  color: [number, number, number],
) {
  if (outer.length < 3) return;

  const allPoints = [...outer, ...holes.flat()];
  const faces = THREE.ShapeUtils.triangulateShape(
    outer.map(point => point.clone()),
    holes.map(hole => hole.map(point => point.clone())),
  );

  const pushVertex = (point: THREE.Vector3) => {
    data.roofPositions.push(point.x, point.y, point.z);
    data.roofNormals.push(0, 1, 0);
    data.roofUvs.push(point.x / roofModuleSize, point.z / roofModuleSize);
    // 屋根は壁より少し暗くする
    data.roofColors.push(color[0] * 0.72, color[1] * 0.72, color[2] * 0.72);
  };

  faces.forEach(face => {
    let b = allPoints[face[1]];
    let c = allPoints[face[2]];
    const a = allPoints[face[0]];

    if (!a || !b || !c) return;

    const pa = new THREE.Vector3(a.x, top, a.y);
    const pb = new THREE.Vector3(b.x, top, b.y);
    const pc = new THREE.Vector3(c.x, top, c.y);

    const cross = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa));
    if (cross.y < 0) {
      const temporary = b;
      b = c;
      c = temporary;
    }

    pushVertex(new THREE.Vector3(a.x, top, a.y));
    pushVertex(new THREE.Vector3(b.x, top, b.y));
    pushVertex(new THREE.Vector3(c.x, top, c.y));
  });
}

function addBuilding(
  data: BuildingGeometryBuilder,
  rings: Position[][],
  originCoordinate: Position,
  base: number,
  top: number,
  color: [number, number, number],
  floorHeight: number,
) {
  if (!rings.length) return false;

  const outer = toOpenRing(rings[0], originCoordinate);
  if (outer.length < 3) return false;

  const holes = rings
    .slice(1)
    .map(ring => toOpenRing(ring, originCoordinate))
    .filter(ring => ring.length >= 3);

  ensureOrientation(outer, true);
  holes.forEach(hole => ensureOrientation(hole, false));

  pushWall(data, outer, base, top, color, floorHeight);
  holes.forEach(hole => pushWall(data, hole, base, top, color, floorHeight));
  pushRoof(data, outer, holes, top, color);

  return true;
}

/**
 * 建物 Polygon から、壁と屋根の結合済みジオメトリデータを生成する。
 * GeoJSON をソース、この戻り値をキャッシュ／派生物として扱う。
 */
export function buildBuildingGeometryData(
  entries: BuildingSourceEntry[],
  originCoordinate: Position,
  floorHeight = buildingFloorHeight,
): BuildingGeometryData {
  const data: BuildingGeometryBuilder = {
    wallPositions: [],
    wallNormals: [],
    wallUvs: [],
    wallColors: [],
    roofPositions: [],
    roofNormals: [],
    roofUvs: [],
    roofColors: [],
    buildingCount: 0,
  };

  entries.forEach(entry => {
    entry.value.features.forEach(feature => {
      if (!isBuildingFeature(feature)) return;

      const geometry = feature.geometry;
      let polygons: Position[][][] = [];

      if (geometry.type === 'Polygon')
        polygons = [(geometry as Polygon).coordinates];
      else if (geometry.type === 'MultiPolygon')
        polygons = (geometry as MultiPolygon).coordinates;
      else
        return;

      const id = String(feature.id ?? feature.properties?.['@id'] ?? `${entry.id}/${data.buildingCount}`);
      const { base, top } = getBuildingHeights(feature.properties, floorHeight);
      const color = getBuildingColor(feature.properties, id);

      polygons.forEach(rings => {
        if (addBuilding(data, rings, originCoordinate, base, top, color, floorHeight))
          data.buildingCount++;
      });
    });
  });

  return {
    wallPositions: new Float32Array(data.wallPositions),
    wallNormals: new Float32Array(data.wallNormals),
    wallUvs: new Float32Array(data.wallUvs),
    wallColors: new Float32Array(data.wallColors),
    roofPositions: new Float32Array(data.roofPositions),
    roofNormals: new Float32Array(data.roofNormals),
    roofUvs: new Float32Array(data.roofUvs),
    roofColors: new Float32Array(data.roofColors),
    buildingCount: data.buildingCount,
  };
}
