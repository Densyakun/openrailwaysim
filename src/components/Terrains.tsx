import React, { Suspense, useDeferredValue, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { HeightmapType, heightmapSize, merc, terrainZoom } from "@/lib/terrain"
import FeatureObject from './FeatureObject'
import SlopeBlendMaterial from './SlopeBlendMaterial'
import distance from "@turf/distance"
import { useSnapshot } from "valtio"
import { terrainsState } from "@/lib/client/terrains"
import { guiState } from "@/lib/client/gui"
import { MeshDiscardMaterial, Plane } from "@react-three/drei"
import { store } from "@/lib/game"
import { useSceneVisibility } from "@/lib/client/sceneVisibility"
import { Brush, Evaluator, SUBTRACTION, ADDITION } from "three-bvh-csg"
import { getRelativePosition, getRotation } from "@/lib/gis"
import { ConstructionTerrainBrush, createConstructionTerrainBrushes } from "@/lib/constructionTerrain"
import { ConstructionZone } from "@/lib/construction"
import { constructionState } from "@/lib/client/construction"
import { Track, TransitionCurve } from "@/lib/tracks"
import { Position } from "geojson"

function buildTerrainGeometry(
  heightmap: HeightmapType,
  terrainSize: number,
  eastHeightmap?: HeightmapType,
  southHeightmap?: HeightmapType,
  southeastHeightmap?: HeightmapType,
) {
  const positions: number[] = []
  const uvs: number[] = []

  const addQuad = (
    x: number,
    y: number,
    h0: number | null,
    h1: number | null,
    h2: number | null,
    h3: number | null,
  ) => {
    if (h0 === null || h1 === null || h2 === null || h3 === null) return

    const x0 = (x / heightmapSize) * terrainSize
    const x1 = ((x + 1) / heightmapSize) * terrainSize
    const z0 = (y / heightmapSize) * terrainSize
    const z1 = ((y + 1) / heightmapSize) * terrainSize

    const u0 = x / (heightmapSize - 1)
    const u1 = (x + 1) / (heightmapSize - 1)
    const v0 = y / (heightmapSize - 1)
    const v1 = (y + 1) / (heightmapSize - 1)

    positions.push(
      x0, h0, z0,
      x0, h1, z1,
      x1, h2, z1,
      x0, h0, z0,
      x1, h2, z1,
      x1, h3, z0,
    )
    uvs.push(
      u0, v0,
      u0, v1,
      u1, v1,
      u0, v0,
      u1, v1,
      u1, v0,
    )
  }

  for (let x = 0; x <= heightmapSize - 2; x++) {
    for (let y = 0; y <= heightmapSize - 2; y++) {
      addQuad(
        x,
        y,
        heightmap[y][x],
        heightmap[y + 1][x],
        heightmap[y + 1][x + 1],
        heightmap[y][x + 1],
      )
    }
  }

  if (eastHeightmap) {
    const x = heightmapSize - 1
    for (let y = 0; y <= heightmapSize - 2; y++) {
      addQuad(
        x,
        y,
        heightmap[y][x],
        heightmap[y + 1][x],
        eastHeightmap[y + 1][0],
        eastHeightmap[y][0],
      )
    }

    if (southHeightmap && southeastHeightmap) {
      const y = heightmapSize - 1
      addQuad(
        x,
        y,
        heightmap[y][x],
        southHeightmap[0][x],
        southeastHeightmap[0][0],
        eastHeightmap[y][0],
      )
    }
  }

  if (southHeightmap) {
    const y = heightmapSize - 1
    for (let x = 0; x <= heightmapSize - 2; x++) {
      addQuad(
        x,
        y,
        heightmap[y][x],
        southHeightmap[0][x],
        southHeightmap[0][x + 1],
        heightmap[y][x + 1],
      )
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
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
  )
  const push = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
    positions.push(
      p0.x, p0.y, p0.z,
      p1.x, p1.y, p1.z,
      p2.x, p2.y, p2.z,
      p0.x, p0.y, p0.z,
      p2.x, p2.y, p2.z,
      p3.x, p3.y, p3.z,
    )
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1)
  }

  if (normal.dot(desiredNormal) < 0) push(a, d, c, b)
  else push(a, b, c, d)
}

function buildTerrainSolidGeometry(
  heightmap: HeightmapType,
  terrainSize: number,
): THREE.BufferGeometry | null {
  const N = heightmapSize
  let minHeight = Infinity

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const height = heightmap[y][x]
      if (height === null) return null
      minHeight = Math.min(minHeight, height)
    }
  }

  const bottomY = minHeight - 100
  const positions: number[] = []
  const uvs: number[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const down = new THREE.Vector3(0, -1, 0)

  const heightAt = (x: number, y: number) =>
    heightmap[Math.min(N - 1, y)][Math.min(N - 1, x)] as number

  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const x0 = (x / N) * terrainSize
      const x1 = ((x + 1) / N) * terrainSize
      const z0 = (y / N) * terrainSize
      const z1 = ((y + 1) / N) * terrainSize

      const v0 = new THREE.Vector3(x0, heightAt(x, y), z0)
      const v1 = new THREE.Vector3(x0, heightAt(x, y + 1), z1)
      const v2 = new THREE.Vector3(x1, heightAt(x + 1, y + 1), z1)
      const v3 = new THREE.Vector3(x1, heightAt(x + 1, y), z0)

      pushOrientedQuad(positions, uvs, v0, v1, v2, v3, up)
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
  )

  const west = new THREE.Vector3(-1, 0, 0)
  const east = new THREE.Vector3(1, 0, 0)
  const north = new THREE.Vector3(0, 0, -1)
  const south = new THREE.Vector3(0, 0, 1)

  for (let i = 0; i < N - 1; i++) {
    const z0 = (i / N) * terrainSize
    const z1 = ((i + 1) / N) * terrainSize
    const x0 = (i / N) * terrainSize
    const x1 = ((i + 1) / N) * terrainSize

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(0, heightAt(0, i), z0),
      new THREE.Vector3(0, bottomY, z0),
      new THREE.Vector3(0, bottomY, z1),
      new THREE.Vector3(0, heightAt(0, i + 1), z1),
      west,
    )

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(terrainSize, heightAt(N - 1, i), z0),
      new THREE.Vector3(terrainSize, bottomY, z0),
      new THREE.Vector3(terrainSize, bottomY, z1),
      new THREE.Vector3(terrainSize, heightAt(N - 1, i + 1), z1),
      east,
    )

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(x0, heightAt(i, 0), 0),
      new THREE.Vector3(x0, bottomY, 0),
      new THREE.Vector3(x1, bottomY, 0),
      new THREE.Vector3(x1, heightAt(i + 1, 0), 0),
      north,
    )

    pushOrientedQuad(
      positions, uvs,
      new THREE.Vector3(x0, heightAt(i, N - 1), terrainSize),
      new THREE.Vector3(x0, bottomY, terrainSize),
      new THREE.Vector3(x1, bottomY, terrainSize),
      new THREE.Vector3(x1, heightAt(i + 1, N - 1), terrainSize),
      south,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

function getTileMatrix(tileX: number, tileY: number, originCoordinate: Position) {
  const coordinate = merc.ll([tileX * 256, tileY * 256], terrainZoom)
  const position = getRelativePosition(coordinate, originCoordinate)
  const rotation = getRotation(coordinate, originCoordinate)
  const matrix = new THREE.Matrix4().makeRotationY(rotation.y)
  matrix.setPosition(position)
  return matrix
}

function getTileBounds(tileX: number, tileY: number, originCoordinate: Position) {
  const corners = [
    merc.ll([tileX * 256, tileY * 256], terrainZoom),
    merc.ll([(tileX + 1) * 256, tileY * 256], terrainZoom),
    merc.ll([tileX * 256, (tileY + 1) * 256], terrainZoom),
    merc.ll([(tileX + 1) * 256, (tileY + 1) * 256], terrainZoom),
  ]
  const points = corners.map(corner => getRelativePosition(corner, originCoordinate))
  const bounds = new THREE.Box3().setFromPoints(points).expandByScalar(20)
  bounds.min.y = -Infinity
  bounds.max.y = Infinity
  return bounds
}

function ensureGeometryAttributes(geometry: THREE.BufferGeometry) {
  if (!geometry.getAttribute("uv")) {
    const count = geometry.getAttribute("position")?.count ?? 0
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2))
  }
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals()
  return geometry
}

function applyConstructionBrushes(
  baseGeometry: THREE.BufferGeometry,
  brushes: ConstructionTerrainBrush[],
  tileMatrix: THREE.Matrix4,
) {
  const inverse = tileMatrix.clone().invert()
  const evaluator = new Evaluator()
  evaluator.useGroups = false

  let current = new Brush(baseGeometry)

  const evaluate = (brushGeometry: THREE.BufferGeometry, operation: typeof SUBTRACTION | typeof ADDITION) => {
    const brushMesh = new Brush(brushGeometry)
    const next = evaluator.evaluate(current, brushMesh, operation)
    if (current.geometry !== baseGeometry) current.geometry.dispose()
    current = next
    brushGeometry.dispose()
  }

  for (const brush of brushes) {
    if (brush.cut) evaluate(brush.cut.clone().applyMatrix4(inverse), SUBTRACTION)
    if (brush.fill) evaluate(brush.fill.clone().applyMatrix4(inverse), ADDITION)
  }

  return ensureGeometryAttributes(current.geometry)
}

function TerrainTile({
  tileX,
  tileY,
  heightmap,
  eastHeightmap,
  southHeightmap,
  southeastHeightmap,
  brushes,
  originCoordinate,
}: {
  tileX: number;
  tileY: number;
  heightmap: HeightmapType;
  eastHeightmap?: HeightmapType;
  southHeightmap?: HeightmapType;
  southeastHeightmap?: HeightmapType;
  brushes?: ConstructionTerrainBrush[];
  originCoordinate: Position;
}) {
  const { hoveredTileX, hoveredTileY, selectedTileX, selectedTileY } = useSnapshot(terrainsState);
  const { selectedTab } = useSnapshot(guiState);

  const isHovered = hoveredTileX === tileX && hoveredTileY === tileY;
  const isSelected = selectedTileX === tileX && selectedTileY === tileY;

  // 小さな地形タイルがカメラの近くにある場合、扇形には見えないため、四角形で表示し、大きさのみ合わせる
  const terrainSize = distance(
    merc.ll([0, tileY * 256], terrainZoom),
    merc.ll([0, (tileY + 1) * 256], terrainZoom),
    { units: 'meters' }
  );

  const hasBrushes = !!brushes && brushes.length > 0;

  const base = useMemo(() => {
    if (hasBrushes) {
      const solid = buildTerrainSolidGeometry(heightmap, terrainSize);
      if (solid) return { geometry: solid, isSolid: true };
    }

    return {
      geometry: buildTerrainGeometry(heightmap, terrainSize, eastHeightmap, southHeightmap, southeastHeightmap),
      isSolid: false,
    };
  }, [heightmap, terrainSize, eastHeightmap, southHeightmap, southeastHeightmap, hasBrushes]);

  const deferredBrushes = useDeferredValue(brushes);

  const geometry = useMemo(() => {
    if (!base.isSolid || !deferredBrushes || deferredBrushes.length === 0) return base.geometry;

    try {
      const tileMatrix = getTileMatrix(tileX, tileY, originCoordinate);
      return applyConstructionBrushes(base.geometry, deferredBrushes, tileMatrix);
    } catch (error) {
      console.error('地形CSGの適用に失敗しました', error);
      return base.geometry;
    }
  }, [base, deferredBrushes, tileX, tileY, originCoordinate]);

  return <FeatureObject coordinate={merc.ll([tileX * 256, tileY * 256], terrainZoom)}>
    <mesh
      receiveShadow
      geometry={geometry}
    >
      {
        guiState.selectedTab === "terrains" && isHovered
          ? <meshBasicMaterial color="yellow" />
          : guiState.selectedTab === "terrains" && isSelected
            ? <meshBasicMaterial color="red" />
            : <Suspense fallback={<meshStandardMaterial />}>
              <SlopeBlendMaterial />
            </Suspense>
      }
    </mesh>
    {/** 同じメッシュに影を落とすためにメッシュを分ける */}
    <mesh
      castShadow
      geometry={geometry}
    >
      <MeshDiscardMaterial />
    </mesh>
    {/** 複雑なメッシュではonPointer~イベントが重いので簡単なジオメトリに分ける */}
    {selectedTab === "terrains" &&
      <Plane
        args={[terrainSize, terrainSize, 1, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[terrainSize / 2, 0, terrainSize / 2]}
        onPointerMove={e => {
          e.stopPropagation();

          terrainsState.hoveredTileX = tileX;
          terrainsState.hoveredTileY = tileY;
        }}
        onPointerOut={e => {
          e.stopPropagation();

          if (terrainsState.hoveredTileX === tileX && terrainsState.hoveredTileY === tileY) {
            terrainsState.hoveredTileX = -1;
            terrainsState.hoveredTileY = -1;
          }
        }}
        onClick={e => {
          e.stopPropagation();

          if (terrainsState.selectedTileX === tileX && terrainsState.selectedTileY === tileY) {
            terrainsState.selectedTileX = -1;
            terrainsState.selectedTileY = -1;
          } else {
            terrainsState.selectedTileX = tileX;
            terrainsState.selectedTileY = tileY;
          }
        }}
      >
        <meshStandardMaterial />
      </Plane>
    }
  </FeatureObject>;
}

export default function Terrains() {
  const terrains = useSnapshot(store.data.terrains);
  const originCoordinate = useSnapshot(store.data.originCoordinate);
  const constructionZones = useSnapshot(store.data.constructionZones);
  const tracks = useSnapshot(store.data.tracks);
  const { isVisible } = useSnapshot(terrainsState);
  const { selectedTab } = useSnapshot(guiState);
  const { showTerrains } = useSceneVisibility();

  // 地形タブを開いているときだけ「Visible」設定を使い、それ以外では常に表示する
  const effectiveVisible = selectedTab === "terrains" ? isVisible : true;

  if (!effectiveVisible || !showTerrains) return null;

  return <TerrainsContent
    terrains={terrains as never}
    originCoordinate={originCoordinate as Position}
    constructionZones={constructionZones as never}
    tracks={tracks as never}
  />;
}

function TerrainsContent({
  terrains,
  originCoordinate,
  constructionZones,
  tracks,
}: {
  terrains: { [key: string]: { [key: string]: HeightmapType } };
  originCoordinate: Position;
  constructionZones: { [key: string]: ConstructionZone };
  tracks: { [key: string]: Track | TransitionCurve };
}) {
  const { isEditingZone, isEditingTunnel } = useSnapshot(constructionState);
  const isEditing = isEditingZone || isEditingTunnel;
  const stableBrushes = useRef<ConstructionTerrainBrush[]>([]);

  const computedBrushes = useMemo(() => {
    if (isEditing) return stableBrushes.current;
    return createConstructionTerrainBrushes(
      constructionZones,
      tracks,
      originCoordinate,
      terrains,
    );
  }, [isEditing, constructionZones, tracks, originCoordinate, terrains]);

  useEffect(() => {
    if (!isEditing) stableBrushes.current = computedBrushes;
  }, [computedBrushes, isEditing]);

  useEffect(() => {
    return () => {
      for (const brush of computedBrushes) {
        brush.cut?.dispose();
        brush.fill?.dispose();
      }
    };
  }, [computedBrushes]);

  const allBrushes = isEditing ? stableBrushes.current : computedBrushes;

  const brushesByTile = useMemo(() => {
    const result = new Map<string, ConstructionTerrainBrush[]>();
    if (allBrushes.length === 0) return result;

    for (const tileY_ of Object.keys(terrains)) {
      for (const tileX_ of Object.keys(terrains[tileY_])) {
        const tileX = parseInt(tileX_);
        const tileY = parseInt(tileY_);
        const bounds = getTileBounds(tileX, tileY, originCoordinate);
        const brushes = allBrushes.filter(brush => brush.bounds.intersectsBox(bounds));
        if (brushes.length > 0) result.set(`${tileX}/${tileY}`, brushes);
      }
    }

    return result;
  }, [allBrushes, terrains, originCoordinate]);

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
            brushes={brushesByTile.get(`${tileX}/${tileY}`)}
            originCoordinate={originCoordinate}
          />;
        })}
      </React.Fragment>
    )}
  </>;
}
