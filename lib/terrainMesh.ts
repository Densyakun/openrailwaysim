import * as THREE from 'three';
import { HeightmapType, heightmapSize } from './terrain';

export type TerrainNeighborEdges = {
  east?: Float32Array;
  south?: Float32Array;
  southeast?: number;
};

function edgeValue(values: Float32Array | undefined, index: number, fallback: number) {
  const value = values?.[index];
  return value === undefined || Number.isNaN(value) ? fallback : value;
}

export function createTerrainNeighborEdges(
  eastHeightmap?: HeightmapType,
  southHeightmap?: HeightmapType,
  southeastHeightmap?: HeightmapType,
): TerrainNeighborEdges {
  const east = eastHeightmap
    ? new Float32Array(heightmapSize).map((_, index) => eastHeightmap[index]?.[0] ?? NaN)
    : undefined;
  const south = southHeightmap
    ? new Float32Array(heightmapSize).map((_, index) => southHeightmap[0]?.[index] ?? NaN)
    : undefined;
  return {
    east,
    south,
    southeast: southeastHeightmap?.[0]?.[0] ?? undefined,
  };
}

function pushTopSurface(
  positions: number[],
  uvs: number[],
  heightmap: HeightmapType,
  terrainSize: number,
  step: number,
  edges?: TerrainNeighborEdges,
) {
  const N = heightmapSize;

  for (let x = 0; x < N - 1; x += step) {
    const xNext = Math.min(N - 1, x + step);
    const x0 = (x / N) * terrainSize;
    const x1 = (Math.min(N, x + step) / N) * terrainSize;
    const eastOuter = x + step >= N;
    const u0 = x / (N - 1);
    const u1 = Math.min(1, (x + step) / (N - 1));

    for (let y = 0; y < N - 1; y += step) {
      const yNext = Math.min(N - 1, y + step);
      const z0 = (y / N) * terrainSize;
      const z1 = (Math.min(N, y + step) / N) * terrainSize;
      const southOuter = y + step >= N;
      const v0 = y / (N - 1);
      const v1 = Math.min(1, (y + step) / (N - 1));

      const local00 = heightmap[y]?.[x] ?? null;
      if (local00 === null) continue;

      const local10 = heightmap[yNext]?.[x] ?? null;
      const local11 = heightmap[yNext]?.[xNext] ?? null;
      const local01 = heightmap[y]?.[xNext] ?? null;
      if (local10 === null || local11 === null || local01 === null) continue;

      const h0 = local00;
      const h1 = southOuter
        ? edgeValue(edges?.south, x, heightmap[N - 1][x] ?? local10)
        : local10;
      const h3 = eastOuter
        ? edgeValue(edges?.east, y, heightmap[y][N - 1] ?? local01)
        : local01;
      let h2: number;
      if (eastOuter && southOuter) {
        h2 = edges?.southeast
          ?? edgeValue(edges?.south, N - 1, edgeValue(edges?.east, N - 1, heightmap[N - 1][N - 1] ?? local11));
      } else if (eastOuter) {
        h2 = edgeValue(edges?.east, yNext, heightmap[yNext][N - 1] ?? local11);
      } else if (southOuter) {
        h2 = edgeValue(edges?.south, xNext, heightmap[N - 1][xNext] ?? local11);
      } else {
        h2 = local11;
      }

      positions.push(
        x0, h0, z0,
        x0, h1, z1,
        x1, h2, z1,
        x0, h0, z0,
        x1, h2, z1,
        x1, h3, z0,
      );
      uvs.push(
        u0, v0,
        u0, v1,
        u1, v1,
        u0, v0,
        u1, v1,
        u1, v0,
      );
    }
  }
}

export function buildTerrainGeometry(
  heightmap: HeightmapType,
  terrainSize: number,
  eastHeightmap?: HeightmapType,
  southHeightmap?: HeightmapType,
  southeastHeightmap?: HeightmapType,
  step = 1,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const edges = createTerrainNeighborEdges(eastHeightmap, southHeightmap, southeastHeightmap);
  pushTopSurface(positions, uvs, heightmap, terrainSize, Math.max(1, Math.round(step)), edges);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function pushOrientedQuad(
  positions: number[],
  uvs: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  desiredNormal: THREE.Vector3,
) {
  const normal = new THREE.Vector3().crossVectors(
    b.clone().sub(a),
    c.clone().sub(a),
  );
  const push = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
    positions.push(
      p0.x, p0.y, p0.z,
      p1.x, p1.y, p1.z,
      p2.x, p2.y, p2.z,
      p0.x, p0.y, p0.z,
      p2.x, p2.y, p2.z,
      p3.x, p3.y, p3.z,
    );
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };

  if (normal.dot(desiredNormal) < 0) push(a, d, c, b);
  else push(a, b, c, d);
}

export function buildTerrainSolidGeometry(
  heightmap: HeightmapType,
  terrainSize: number,
  step = 1,
  edges?: TerrainNeighborEdges,
): THREE.BufferGeometry | null {
  const N = heightmapSize;
  let minHeight = Infinity;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const height = heightmap[y][x];
      if (height === null) return null;
      minHeight = Math.min(minHeight, height);
    }
  }

  const normalizedStep = Math.max(1, Math.round(step));
  const bottomY = minHeight - 1000;
  const positions: number[] = [];
  const uvs: number[] = [];
  const down = new THREE.Vector3(0, -1, 0);

  pushTopSurface(positions, uvs, heightmap, terrainSize, normalizedStep, edges);

  pushOrientedQuad(
    positions,
    uvs,
    new THREE.Vector3(0, bottomY, 0),
    new THREE.Vector3(terrainSize, bottomY, 0),
    new THREE.Vector3(terrainSize, bottomY, terrainSize),
    new THREE.Vector3(0, bottomY, terrainSize),
    down,
  );

  const west = new THREE.Vector3(-1, 0, 0);
  const east = new THREE.Vector3(1, 0, 0);
  const north = new THREE.Vector3(0, 0, -1);
  const south = new THREE.Vector3(0, 0, 1);

  for (let index = 0; index < N - 1; index += normalizedStep) {
    const next = Math.min(N - 1, index + normalizedStep);
    const p0 = (index / N) * terrainSize;
    const p1 = (Math.min(N, index + normalizedStep) / N) * terrainSize;

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(0, heightmap[index][0] as number, p0),
      new THREE.Vector3(0, bottomY, p0),
      new THREE.Vector3(0, bottomY, p1),
      new THREE.Vector3(0, heightmap[next][0] as number, p1),
      west,
    );

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(terrainSize, edgeValue(edges?.east, index, heightmap[index][N - 1] as number), p0),
      new THREE.Vector3(terrainSize, bottomY, p0),
      new THREE.Vector3(terrainSize, bottomY, p1),
      new THREE.Vector3(terrainSize, edgeValue(edges?.east, next, heightmap[next][N - 1] as number), p1),
      east,
    );

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(p0, heightmap[0][index] as number, 0),
      new THREE.Vector3(p0, bottomY, 0),
      new THREE.Vector3(p1, bottomY, 0),
      new THREE.Vector3(p1, heightmap[0][next] as number, 0),
      north,
    );

    const southIndex = edgeValue(edges?.south, index, heightmap[N - 1][index] as number);
    const southNext = edgeValue(edges?.south, next, heightmap[N - 1][next] as number);

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(p0, southIndex, terrainSize),
      new THREE.Vector3(p0, bottomY, terrainSize),
      new THREE.Vector3(p1, bottomY, terrainSize),
      new THREE.Vector3(p1, southNext, terrainSize),
      south,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
