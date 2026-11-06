import { describe, expect, it } from 'vitest';
import { HeightmapType, heightmapSize } from '@/lib/terrain';
import { buildTerrainGeometry, createTerrainNeighborEdges } from '@/lib/terrainMesh';

function createHeightmap(height: number): HeightmapType {
  return Array.from({ length: heightmapSize }, () =>
    Array.from({ length: heightmapSize }, () => height)
  );
}

describe('terrain mesh LOD', () => {
  it('reduces triangle count as the LOD step grows', () => {
    const heightmap = createHeightmap(20);
    const step1 = buildTerrainGeometry(heightmap, 1000, undefined, undefined, undefined, 1);
    const step2 = buildTerrainGeometry(heightmap, 1000, undefined, undefined, undefined, 2);
    const step4 = buildTerrainGeometry(heightmap, 1000, undefined, undefined, undefined, 4);

    expect(step1.attributes.position.count / 3).toBe(130050);
    expect(step2.attributes.position.count / 3).toBe(32768);
    expect(step4.attributes.position.count / 3).toBe(8192);
  });

  it('creates neighbor edge values for tile seams', () => {
    const east = createHeightmap(30);
    const south = createHeightmap(40);
    const southeast = createHeightmap(50);
    const edges = createTerrainNeighborEdges(east, south, southeast);

    expect(edges.east?.length).toBe(heightmapSize);
    expect(edges.south?.length).toBe(heightmapSize);
    expect(edges.east?.[0]).toBe(30);
    expect(edges.south?.[0]).toBe(40);
    expect(edges.southeast).toBe(50);
  });
});
