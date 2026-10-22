import * as THREE from 'three'
import { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon, Position } from 'geojson'
import { getRelativePosition } from './gis'
import { getTerrainHeightAt, HeightmapType } from './terrain'

export type BuildingSourceEntry = {
  id: string;
  value: FeatureCollection;
}

export type TerrainHeightmaps = {
  [tileY: string]: {
    [tileX: string]: HeightmapType;
  };
}

export type BuildingGenerationOptions = {
  floorHeight?: number;
  followTerrain?: boolean;
  foundationDepth?: number;
  seed?: number;
  variation?: boolean;
  terrains?: TerrainHeightmaps;
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
  foundationPositions: Float32Array;
  foundationNormals: Float32Array;
  foundationUvs: Float32Array;
  foundationColors: Float32Array;
  buildingCount: number;
}

type WallBuffers = {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
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
  foundationPositions: number[];
  foundationNormals: number[];
  foundationUvs: number[];
  foundationColors: number[];
  buildingCount: number;
}

type RoofStyle = 'flat' | 'pyramid'

type BuildingVariant = {
  roof: RoofStyle;
  facadeWidth: number;
  tint: [number, number, number];
}

const facadeWidthVariants = [3.4, 4, 4.6]
const tintVariants: [number, number, number][] = [
  [1, 1, 1],
  [1.04, 1, 0.94],
  [0.96, 1, 1.05],
  [1.02, 1.03, 0.98],
]

export const buildingFloorHeight = 3
const roofModuleSize = 4
const maximumBuildingHeight = 300
const minimumBuildingHeight = 2
const maximumTerrainSamples = 12

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

function getBuildingVariant(id: string, seed: number, variation: boolean): BuildingVariant {
  if (!variation)
    return { roof: 'flat', facadeWidth: 4, tint: [1, 1, 1] };

  const hash = hashString(`${id}/${seed}`);

  return {
    roof: (hash & 1) ? 'pyramid' : 'flat',
    facadeWidth: facadeWidthVariants[(hash >>> 1) % facadeWidthVariants.length],
    tint: tintVariants[(hash >>> 3) % tintVariants.length],
  };
}

function getRoofStyle(properties: GeoJsonProperties, variant: BuildingVariant): RoofStyle {
  const shape = properties?.['roof:shape'];

  if (shape === 'flat') return 'flat';
  if (shape === 'gabled' || shape === 'hipped' || shape === 'pyramidal' || shape === 'half-hipped')
    return 'pyramid';

  return variant.roof;
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

function sampleGroundHeight(
  points: THREE.Vector2[],
  originCoordinate: Position,
  terrains: TerrainHeightmaps,
) {
  let minimum = Infinity;
  let maximum = -Infinity;
  let sum = 0;
  let count = 0;

  const step = Math.max(1, Math.ceil(points.length / maximumTerrainSamples));
  const sample = (x: number, z: number) => {
    const height = getTerrainHeightAt(new THREE.Vector3(x, 0, z), originCoordinate, terrains);
    if (height === null) return;

    minimum = Math.min(minimum, height);
    maximum = Math.max(maximum, height);
    sum += height;
    count++;
  };

  for (let index = 0; index < points.length; index += step)
    sample(points[index].x, points[index].y);

  let centerX = 0;
  let centerZ = 0;
  points.forEach(point => {
    centerX += point.x;
    centerZ += point.y;
  });
  sample(centerX / points.length, centerZ / points.length);

  if (!count) return undefined;

  return {
    average: sum / count,
    minimum,
    maximum,
  };
}

function pushWall(
  target: WallBuffers,
  ring: THREE.Vector2[],
  base: number,
  top: number,
  color: [number, number, number],
  floorHeight: number,
  facadeWidth: number,
) {
  if (ring.length < 3) return;

  const counterClockwise = signedArea(ring) > 0;
  let distance = 0;

  const pushVertex = (point: THREE.Vector3, normal: THREE.Vector3, u: number, v: number) => {
    target.positions.push(point.x, point.y, point.z);
    target.normals.push(normal.x, normal.y, normal.z);
    target.uvs.push(u, v);
    target.colors.push(color[0], color[1], color[2]);
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

    const u0 = distance / facadeWidth;
    const u1 = (distance + length) / facadeWidth;
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

function pushFlatRoof(
  data: BuildingGeometryBuilder,
  outer: THREE.Vector2[],
  holes: THREE.Vector2[][],
  top: number,
  color: [number, number, number],
) {
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

function pushPyramidRoof(
  data: BuildingGeometryBuilder,
  outer: THREE.Vector2[],
  top: number,
  color: [number, number, number],
) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let centerX = 0;
  let centerZ = 0;

  outer.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.y);
    maxZ = Math.max(maxZ, point.y);
    centerX += point.x;
    centerZ += point.y;
  });

  const roofHeight = Math.min(6, Math.max(1.2, Math.min(maxX - minX, maxZ - minZ) * 0.22));
  const apex = new THREE.Vector3(centerX / outer.length, top + roofHeight, centerZ / outer.length);

  for (let index = 0; index < outer.length; index++) {
    const current = outer[index];
    const next = outer[(index + 1) % outer.length];
    let p0 = new THREE.Vector3(current.x, top, current.y);
    let p1 = new THREE.Vector3(next.x, top, next.y);

    const cross = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(apex, p0));
    if (cross.y < 0) {
      const temporary = p0;
      p0 = p1;
      p1 = temporary;
    }

    const normal = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(apex, p0)).normalize();

    [p0, p1, apex].forEach(point => {
      data.roofPositions.push(point.x, point.y, point.z);
      data.roofNormals.push(normal.x, normal.y, normal.z);
      data.roofUvs.push(point.x / roofModuleSize, point.z / roofModuleSize);
      data.roofColors.push(color[0] * 0.68, color[1] * 0.68, color[2] * 0.68);
    });
  }
}

function addBuilding(
  data: BuildingGeometryBuilder,
  rings: Position[][],
  originCoordinate: Position,
  base: number,
  top: number,
  color: [number, number, number],
  variant: BuildingVariant,
  roofStyle: RoofStyle,
  options: Required<Pick<BuildingGenerationOptions, 'floorHeight' | 'followTerrain' | 'foundationDepth'>> & {
    terrains?: TerrainHeightmaps;
  },
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

  const ground = options.followTerrain && options.terrains
    ? sampleGroundHeight(outer, originCoordinate, options.terrains)
    : undefined;
  const groundHeight = ground?.average ?? 0;
  const wallBase = groundHeight + base;
  const wallTop = groundHeight + top;
  const foundationBottom = ground
    ? Math.min(ground.minimum, wallBase) - options.foundationDepth
    : wallBase;

  const wallTarget: WallBuffers = {
    positions: data.wallPositions,
    normals: data.wallNormals,
    uvs: data.wallUvs,
    colors: data.wallColors,
  };
  const foundationTarget: WallBuffers = {
    positions: data.foundationPositions,
    normals: data.foundationNormals,
    uvs: data.foundationUvs,
    colors: data.foundationColors,
  };

  if (wallBase - foundationBottom > 0.05) {
    const foundationColor: [number, number, number] = [0.42, 0.42, 0.39];
    pushWall(foundationTarget, outer, foundationBottom, wallBase, foundationColor, options.floorHeight, variant.facadeWidth);
    holes.forEach(hole => pushWall(foundationTarget, hole, foundationBottom, wallBase, foundationColor, options.floorHeight, variant.facadeWidth));
  }

  pushWall(wallTarget, outer, wallBase, wallTop, color, options.floorHeight, variant.facadeWidth);
  holes.forEach(hole => pushWall(wallTarget, hole, wallBase, wallTop, color, options.floorHeight, variant.facadeWidth));

  if (roofStyle === 'pyramid' && !holes.length && outer.length <= 16)
    pushPyramidRoof(data, outer, wallTop, color);
  else
    pushFlatRoof(data, outer, holes, wallTop, color);

  return true;
}

/**
 * 建物 Polygon から、壁・屋根・基礎の結合済みジオメトリデータを生成する。
 * GeoJSON をソース、この戻り値をキャッシュ／派生物として扱う。
 */
export function buildBuildingGeometryData(
  entries: BuildingSourceEntry[],
  originCoordinate: Position,
  options: BuildingGenerationOptions = {},
): BuildingGeometryData {
  const floorHeight = options.floorHeight ?? buildingFloorHeight;
  const followTerrain = options.followTerrain ?? true;
  const foundationDepth = options.foundationDepth ?? 2;
  const seed = options.seed ?? 1;
  const variation = options.variation ?? true;

  const data: BuildingGeometryBuilder = {
    wallPositions: [],
    wallNormals: [],
    wallUvs: [],
    wallColors: [],
    roofPositions: [],
    roofNormals: [],
    roofUvs: [],
    roofColors: [],
    foundationPositions: [],
    foundationNormals: [],
    foundationUvs: [],
    foundationColors: [],
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
      const variant = getBuildingVariant(id, seed, variation);
      const roofStyle = getRoofStyle(feature.properties, variant);
      const baseColor = getBuildingColor(feature.properties, id);
      const color: [number, number, number] = [
        Math.min(1, Math.max(0, baseColor[0] * variant.tint[0])),
        Math.min(1, Math.max(0, baseColor[1] * variant.tint[1])),
        Math.min(1, Math.max(0, baseColor[2] * variant.tint[2])),
      ];

      polygons.forEach(rings => {
        if (addBuilding(data, rings, originCoordinate, base, top, color, variant, roofStyle, {
          floorHeight,
          followTerrain,
          foundationDepth,
          terrains: options.terrains,
        }))
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
    foundationPositions: new Float32Array(data.foundationPositions),
    foundationNormals: new Float32Array(data.foundationNormals),
    foundationUvs: new Float32Array(data.foundationUvs),
    foundationColors: new Float32Array(data.foundationColors),
    buildingCount: data.buildingCount,
  };
}
