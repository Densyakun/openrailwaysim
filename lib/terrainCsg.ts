import * as THREE from 'three';
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { HeightmapType, heightmapSize } from './terrain';
import { buildTerrainSolidGeometry, TerrainNeighborEdges } from './terrainMesh';

export type SerializedGeometry = {
  position: Float32Array;
  uv: Float32Array;
};

export type SerializedCsgBrush = {
  cut?: SerializedGeometry;
  fill?: SerializedGeometry;
};

export type SerializedTerrainCsgResult = SerializedGeometry & {
  normal: Float32Array;
};

function deserializeGeometry(data: SerializedGeometry) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function stripSlabFaces(
  geometry: THREE.BufferGeometry,
  terrainSize: number,
  minHeight: number,
) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position || !normal) return geometry;

  const epsilon = Math.max(0.01, Math.abs(terrainSize) * 1e-5);
  const bottomLimit = minHeight - 50;
  const positions: number[] = [];
  const uvs: number[] = [];

  for (let triangle = 0; triangle < position.count; triangle += 3) {
    const x0 = position.getX(triangle);
    const y0 = position.getY(triangle);
    const z0 = position.getZ(triangle);
    const x1 = position.getX(triangle + 1);
    const y1 = position.getY(triangle + 1);
    const z1 = position.getZ(triangle + 1);
    const x2 = position.getX(triangle + 2);
    const y2 = position.getY(triangle + 2);
    const z2 = position.getZ(triangle + 2);

    const onWest = Math.abs(x0) < epsilon && Math.abs(x1) < epsilon && Math.abs(x2) < epsilon;
    const onEast = Math.abs(x0 - terrainSize) < epsilon && Math.abs(x1 - terrainSize) < epsilon && Math.abs(x2 - terrainSize) < epsilon;
    const onNorth = Math.abs(z0) < epsilon && Math.abs(z1) < epsilon && Math.abs(z2) < epsilon;
    const onSouth = Math.abs(z0 - terrainSize) < epsilon && Math.abs(z1 - terrainSize) < epsilon && Math.abs(z2 - terrainSize) < epsilon;
    const onBottom = y0 < bottomLimit && y1 < bottomLimit && y2 < bottomLimit;

    if (onWest || onEast || onNorth || onSouth || onBottom) continue;

    positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);

    // 地形と同じ平面マッピングに統一する
    uvs.push(
      x0 / terrainSize, z0 / terrainSize,
      x1 / terrainSize, z1 / terrainSize,
      x2 / terrainSize, z2 / terrainSize,
    );
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  result.computeVertexNormals();
  return result;
}

export function evaluateTerrainCsg(
  heightmap: HeightmapType,
  terrainSize: number,
  inverseMatrix: number[],
  brushes: SerializedCsgBrush[],
  step = 1,
  edges?: TerrainNeighborEdges,
): SerializedTerrainCsgResult | null {
  const baseGeometry = buildTerrainSolidGeometry(heightmap, terrainSize, step, edges);
  if (!baseGeometry) return null;

  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let y = 0; y < heightmapSize; y++) {
    for (let x = 0; x < heightmapSize; x++) {
      const height = heightmap[y]?.[x];
      if (height !== null && height !== undefined) {
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
      }
    }
  }

  const inverse = new THREE.Matrix4().fromArray(inverseMatrix);
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let current = new Brush(baseGeometry);

  const evaluate = (
    geometry: THREE.BufferGeometry,
    operation: typeof SUBTRACTION | typeof ADDITION,
  ) => {
    const brushMesh = new Brush(geometry);
    const next = evaluator.evaluate(current, brushMesh, operation);
    if (current.geometry !== baseGeometry) current.geometry.dispose();
    current = next;
  };

  const clippingBottom = minHeight - 1001;
  const clippingTop = maxHeight + 1001;

  const clipToTile = (geometry: THREE.BufferGeometry) => {
    const box = new THREE.BoxGeometry(
      terrainSize,
      clippingTop - clippingBottom,
      terrainSize,
    );
    box.translate(terrainSize / 2, (clippingTop + clippingBottom) / 2, terrainSize / 2);
    box.computeVertexNormals();
    const clipEvaluator = new Evaluator();
    clipEvaluator.useGroups = false;
    const clipped = clipEvaluator.evaluate(new Brush(geometry), new Brush(box), INTERSECTION).geometry;
    box.dispose();
    return clipped;
  };

  for (const brush of brushes) {
    if (brush.cut) {
      const local = deserializeGeometry(brush.cut).applyMatrix4(inverse);
      const geometry = clipToTile(local);
      local.dispose();
      if (geometry.getAttribute('position')?.count) evaluate(geometry, SUBTRACTION);
      geometry.dispose();
    }

    if (brush.fill) {
      const local = deserializeGeometry(brush.fill).applyMatrix4(inverse);
      const geometry = clipToTile(local);
      local.dispose();
      if (geometry.getAttribute('position')?.count) evaluate(geometry, ADDITION);
      geometry.dispose();
    }
  }

  let geometry = current.geometry;
  if (geometry.index) geometry = geometry.toNonIndexed();
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

  geometry = stripSlabFaces(geometry, terrainSize, minHeight);

  return {
    position: new Float32Array(geometry.attributes.position.array as ArrayLike<number>),
    uv: new Float32Array(geometry.attributes.uv.array as ArrayLike<number>),
    normal: new Float32Array(geometry.attributes.normal.array as ArrayLike<number>),
  };
}
