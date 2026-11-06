import * as THREE from 'three';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { HeightmapType } from './terrain';
import { buildTerrainSolidGeometry } from './terrainMesh';

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

export function evaluateTerrainCsg(
  heightmap: HeightmapType,
  terrainSize: number,
  inverseMatrix: number[],
  brushes: SerializedCsgBrush[],
): SerializedTerrainCsgResult | null {
  const baseGeometry = buildTerrainSolidGeometry(heightmap, terrainSize);
  if (!baseGeometry) return null;

  const inverse = new THREE.Matrix4().fromArray(inverseMatrix);
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let current = new Brush(baseGeometry);

  const evaluate = (geometry: THREE.BufferGeometry, operation: typeof SUBTRACTION | typeof ADDITION) => {
    const brushMesh = new Brush(geometry);
    const next = evaluator.evaluate(current, brushMesh, operation);
    if (current.geometry !== baseGeometry) current.geometry.dispose();
    current = next;
  };

  for (const brush of brushes) {
    if (brush.cut) {
      const geometry = deserializeGeometry(brush.cut).applyMatrix4(inverse);
      evaluate(geometry, SUBTRACTION);
      geometry.dispose();
    }

    if (brush.fill) {
      const geometry = deserializeGeometry(brush.fill).applyMatrix4(inverse);
      evaluate(geometry, ADDITION);
      geometry.dispose();
    }
  }

  const geometry = current.geometry;
  if (!geometry.getAttribute('uv')) {
    const count = geometry.getAttribute('position')?.count ?? 0;
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

  return {
    position: new Float32Array(geometry.attributes.position.array as ArrayLike<number>),
    uv: new Float32Array(geometry.attributes.uv.array as ArrayLike<number>),
    normal: new Float32Array(geometry.attributes.normal.array as ArrayLike<number>),
  };
}
