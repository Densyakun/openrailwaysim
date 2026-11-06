import * as THREE from 'three';
import { HeightmapType, heightmapSize } from './terrain';

export function buildTerrainGeometry(
  heightmap: HeightmapType,
  terrainSize: number,
  eastHeightmap?: HeightmapType,
  southHeightmap?: HeightmapType,
  southeastHeightmap?: HeightmapType,
) {
  const positions: number[] = [];
  const uvs: number[] = [];

  const addQuad = (
    x: number,
    y: number,
    h0: number | null,
    h1: number | null,
    h2: number | null,
    h3: number | null,
  ) => {
    if (h0 === null || h1 === null || h2 === null || h3 === null) return;

    const x0 = (x / heightmapSize) * terrainSize;
    const x1 = ((x + 1) / heightmapSize) * terrainSize;
    const z0 = (y / heightmapSize) * terrainSize;
    const z1 = ((y + 1) / heightmapSize) * terrainSize;

    const u0 = x / (heightmapSize - 1);
    const u1 = (x + 1) / (heightmapSize - 1);
    const v0 = y / (heightmapSize - 1);
    const v1 = (y + 1) / (heightmapSize - 1);

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
  };

  for (let x = 0; x <= heightmapSize - 2; x++) {
    for (let y = 0; y <= heightmapSize - 2; y++) {
      addQuad(
        x,
        y,
        heightmap[y][x],
        heightmap[y + 1][x],
        heightmap[y + 1][x + 1],
        heightmap[y][x + 1],
      );
    }
  }

  if (eastHeightmap) {
    const x = heightmapSize - 1;
    for (let y = 0; y <= heightmapSize - 2; y++) {
      addQuad(
        x,
        y,
        heightmap[y][x],
        heightmap[y + 1][x],
        eastHeightmap[y + 1][0],
        eastHeightmap[y][0],
      );
    }

    if (southHeightmap && southeastHeightmap) {
      const y = heightmapSize - 1;
      addQuad(
        x,
        y,
        heightmap[y][x],
        southHeightmap[0][x],
        southeastHeightmap[0][0],
        eastHeightmap[y][0],
      );
    }
  }

  if (southHeightmap) {
    const y = heightmapSize - 1;
    for (let x = 0; x <= heightmapSize - 2; x++) {
      addQuad(
        x,
        y,
        heightmap[y][x],
        southHeightmap[0][x],
        southHeightmap[0][x + 1],
        heightmap[y][x + 1],
      );
    }
  }

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

  const bottomY = minHeight - 100;
  const positions: number[] = [];
  const uvs: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const down = new THREE.Vector3(0, -1, 0);

  const heightAt = (x: number, y: number) =>
    heightmap[Math.min(N - 1, y)][Math.min(N - 1, x)] as number;

  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const x0 = (x / N) * terrainSize;
      const x1 = ((x + 1) / N) * terrainSize;
      const z0 = (y / N) * terrainSize;
      const z1 = ((y + 1) / N) * terrainSize;

      const v0 = new THREE.Vector3(x0, heightAt(x, y), z0);
      const v1 = new THREE.Vector3(x0, heightAt(x, y + 1), z1);
      const v2 = new THREE.Vector3(x1, heightAt(x + 1, y + 1), z1);
      const v3 = new THREE.Vector3(x1, heightAt(x + 1, y), z0);

      pushOrientedQuad(positions, uvs, v0, v1, v2, v3, up);
    }
  }

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

  for (let i = 0; i < N - 1; i++) {
    const z0 = (i / N) * terrainSize;
    const z1 = ((i + 1) / N) * terrainSize;
    const x0 = (i / N) * terrainSize;
    const x1 = ((i + 1) / N) * terrainSize;

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(0, heightAt(0, i), z0),
      new THREE.Vector3(0, bottomY, z0),
      new THREE.Vector3(0, bottomY, z1),
      new THREE.Vector3(0, heightAt(0, i + 1), z1),
      west,
    );

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(terrainSize, heightAt(N - 1, i), z0),
      new THREE.Vector3(terrainSize, bottomY, z0),
      new THREE.Vector3(terrainSize, bottomY, z1),
      new THREE.Vector3(terrainSize, heightAt(N - 1, i + 1), z1),
      east,
    );

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(x0, heightAt(i, 0), 0),
      new THREE.Vector3(x0, bottomY, 0),
      new THREE.Vector3(x1, bottomY, 0),
      new THREE.Vector3(x1, heightAt(i + 1, 0), 0),
      north,
    );

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(x0, heightAt(i, N - 1), terrainSize),
      new THREE.Vector3(x0, bottomY, terrainSize),
      new THREE.Vector3(x1, bottomY, terrainSize),
      new THREE.Vector3(x1, heightAt(i + 1, N - 1), terrainSize),
      south,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
