import React, { useEffect, useMemo, useRef } from "react"
import { BufferAttribute, Mesh } from "three"
import { HeightmapType, heightmapSize, terrainZoom } from "@/lib/terrain"
import { SphericalMercator } from '@mapbox/sphericalmercator'
import FeatureObject from './FeatureObject'
import distance from "@turf/distance"
import { clientState, gameState } from "@/lib/client"
import { useSnapshot } from "valtio"

export const merc = new SphericalMercator({
  size: 256,
  antimeridian: true
});

function TerrainTile({
  tileX,
  tileY,
  heightmap,
  eastHeightmap,
  southHeightmap,
  southeastHeightmap,
}: {
  tileX: number;
  tileY: number;
  heightmap: HeightmapType;
  eastHeightmap?: HeightmapType;
  southHeightmap?: HeightmapType;
  southeastHeightmap?: HeightmapType;
}) {
  // 小さな地形タイルがカメラの近くにある場合、扇形には見えないため、四角形で表示し、大きさのみ合わせる
  const terrainSize = distance(
    merc.ll([0, tileY * 256], terrainZoom),
    merc.ll([0, (tileY + 1) * 256], terrainZoom),
    { units: 'meters' }
  );

  const meshRef = useRef<Mesh>(null!);

  const vertices = useMemo(() => new Float32Array(heightmapSize ** 2 * 2 * 3 * 3), []);

  useEffect(() => {
    function a(x: number, y: number, i: number, h0: number | null, h1: number | null, h2: number | null, h3: number | null) {
      if (h0 === null
        || h1 === null
        || h2 === null
        || h3 === null) {
        vertices[i] =
          vertices[i + 1] =
          vertices[i + 2] =
          vertices[i + 3] =
          vertices[i + 4] =
          vertices[i + 5] =
          vertices[i + 6] =
          vertices[i + 7] =
          vertices[i + 8] =
          vertices[i + 9] =
          vertices[i + 10] =
          vertices[i + 11] =
          vertices[i + 12] =
          vertices[i + 13] =
          vertices[i + 14] =
          vertices[i + 15] =
          vertices[i + 16] =
          vertices[i + 17] = 0;
      } else {
        const x0 = (x / heightmapSize) * terrainSize;
        const x1 = ((x + 1) / heightmapSize) * terrainSize;
        const z0 = (y / heightmapSize) * terrainSize;
        const z1 = ((y + 1) / heightmapSize) * terrainSize;

        vertices[i] =
          vertices[i + 15] = x0;
        vertices[i + 1] =
          vertices[i + 16] = h0;
        vertices[i + 2] =
          vertices[i + 17] = z0;

        vertices[i + 3] = x0;
        vertices[i + 4] = h1;
        vertices[i + 5] = z1;

        vertices[i + 6] =
          vertices[i + 9] = x1;
        vertices[i + 7] =
          vertices[i + 10] = h2;
        vertices[i + 8] =
          vertices[i + 11] = z1;

        vertices[i + 12] = x1;
        vertices[i + 13] = h3;
        vertices[i + 14] = z0;
      }
    }

    for (let x = 0; x <= heightmapSize - 2; x++) {
      for (let y = 0; y <= heightmapSize - 2; y++) {
        a(x, y,
          ((y + 1) * (heightmapSize - 1) + x) * 2 * 3 * 3,
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
        a(x, y,
          y * 2 * 3 * 3,
          heightmap[y][x],
          heightmap[y + 1][x],
          eastHeightmap[y + 1][0],
          eastHeightmap[y][0],
        );
      }

      if (southHeightmap && southeastHeightmap) {
        const y = heightmapSize - 1;
        a(x, y,
          ((y + 1) * (heightmapSize - 1) + x) * 2 * 3 * 3,
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
        a(x, y,
          ((y + 1) * (heightmapSize - 1) + x) * 2 * 3 * 3,
          heightmap[y][x],
          southHeightmap[0][x],
          southHeightmap[0][x + 1],
          heightmap[y][x + 1],
        );
      }
    }

    const { geometry } = meshRef.current;
    geometry.setAttribute("position", new BufferAttribute(vertices, 3));

    geometry.setDrawRange(
      eastHeightmap ? 0 : (heightmapSize - 1) * 2 * 3,
      (
        eastHeightmap && southHeightmap ?
          southeastHeightmap ? heightmapSize ** 2
            : heightmapSize ** 2 - 1
          : southHeightmap ? heightmapSize * (heightmapSize - 1)
            : heightmapSize * (heightmapSize - 1)
      ) * 2 * 3
    );
  }, [heightmap, eastHeightmap, southHeightmap, southeastHeightmap]);

  useEffect(() => {
    const { geometry } = meshRef.current;
    geometry.computeVertexNormals();
  });

  return <FeatureObject centerCoordinate={merc.ll([tileX * 256, tileY * 256], terrainZoom)}>
    <mesh castShadow receiveShadow ref={meshRef}>
      <bufferGeometry attributes={{ "position": new BufferAttribute(vertices, 3) }} />
      <meshStandardMaterial />
    </mesh>
  </FeatureObject>;
}

export default function Terrains() {
  useSnapshot(clientState);
  const terrains = useSnapshot(gameState.data.terrains);

  return <>
    {Object.keys(terrains).map(tileY_ =>
      <React.Fragment key={tileY_}>
        {Object.keys(terrains[tileY_]).map(tileX_ => {
          const tileX = parseInt(tileX_);
          const tileY = parseInt(tileY_);

          return <TerrainTile
            key={tileX_}
            tileX={tileX}
            tileY={tileY}
            heightmap={terrains[tileY_][tileX_] as HeightmapType}
            eastHeightmap={terrains[tileY_]?.[tileX + 1] as HeightmapType}
            southHeightmap={terrains[tileY + 1]?.[tileX_] as HeightmapType}
            southeastHeightmap={terrains[tileY + 1]?.[tileX + 1] as HeightmapType}
          />;
        })}
      </React.Fragment>
    )}
  </>;
}
