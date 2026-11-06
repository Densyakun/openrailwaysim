import React, { Suspense, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { HeightmapType, merc, terrainZoom } from "@/lib/terrain"
import FeatureObject from './FeatureObject'
import SlopeBlendMaterial from './SlopeBlendMaterial'
import distance from "@turf/distance"
import { useSnapshot } from "valtio"
import { terrainsState } from "@/lib/client/terrains"
import { guiState } from "@/lib/client/gui"
import { MeshDiscardMaterial, Plane } from "@react-three/drei"
import { store } from "@/lib/game"
import { useSceneVisibility } from "@/lib/client/sceneVisibility"
import { getRelativePosition, getRotation } from "@/lib/gis"
import { ConstructionTerrainBrush, createConstructionTerrainBrushes } from "@/lib/constructionTerrain"
import { ConstructionZone } from "@/lib/construction"
import { constructionState } from "@/lib/client/construction"
import { Track, TransitionCurve } from "@/lib/tracks"
import { buildTerrainGeometry } from "@/lib/terrainMesh"
import {
  publishTerrainCsgBrushes,
  requestTerrainCsg,
  terrainCsgRevisionState,
} from "@/src/workers/terrainCsgManager"
import { Position } from "geojson"

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
  const { revision } = useSnapshot(terrainCsgRevisionState);

  const isHovered = hoveredTileX === tileX && hoveredTileY === tileY;
  const isSelected = selectedTileX === tileX && selectedTileY === tileY;

  // 小さな地形タイルがカメラの近くにある場合、扇形には見えないため、四角形で表示し、大きさのみ合わせる
  const terrainSize = distance(
    merc.ll([0, tileY * 256], terrainZoom),
    merc.ll([0, (tileY + 1) * 256], terrainZoom),
    { units: 'meters' }
  );

  const baseGeometry = useMemo(
    () => buildTerrainGeometry(heightmap, terrainSize, eastHeightmap, southHeightmap, southeastHeightmap),
    [heightmap, terrainSize, eastHeightmap, southHeightmap, southeastHeightmap],
  );

  const [csgGeometry, setCsgGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (revision === 0 || !brushes || brushes.length === 0) {
      setCsgGeometry(null);
      return;
    }

    let cancelled = false;
    const tileMatrix = getTileMatrix(tileX, tileY, originCoordinate);
    const inverseMatrix = tileMatrix.clone().invert().elements.slice();

    void requestTerrainCsg({
      tileX,
      tileY,
      heightmap,
      terrainSize,
      inverseMatrix,
      brushIds: brushes.map(brush => brush.zoneId),
    }).then(result => {
      if (cancelled || !result) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(result.position, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(result.uv, 2));
      geometry.setAttribute('normal', new THREE.BufferAttribute(result.normal, 3));
      setCsgGeometry(geometry);
    }).catch(error => {
      console.error('地形CSGの適用に失敗しました', error);
    });

    return () => {
      cancelled = true;
    };
  }, [revision, brushes, heightmap, terrainSize, tileX, tileY, originCoordinate]);

  const geometry = csgGeometry ?? baseGeometry;

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

  useEffect(() => {
    if (isEditing) return;
    publishTerrainCsgBrushes(allBrushes);
  }, [allBrushes, isEditing]);

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
