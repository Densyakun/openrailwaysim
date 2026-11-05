// 造成ゾーンの3Dレンダリング
import React, { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';
import { guiState } from '@/lib/client/gui';
import { constructionState } from '@/lib/client/construction';
import { useSceneVisibility } from '@/lib/client/sceneVisibility';
import {
  CONSTRUCTION_PART_INFO,
  ConstructionSolids,
  ConstructionZone,
  TerrainHeightSampler,
  createConstructionLandscapeParts,
  createConstructionSolids,
  getConstructionFrames,
} from '@/lib/construction';
import { getTerrainHeightAt, HeightmapType } from '@/lib/terrain';
import { Track, TransitionCurve } from '@/lib/tracks';
import { Position } from 'geojson';

function createTerrainSampler(
  originCoordinate: Position,
  terrains: { [key: string]: { [key: string]: HeightmapType } },
): TerrainHeightSampler {
  const cache = new Map<string, number | null>();
  return (x, z) => {
    const key = `${Math.round(x / 2)},${Math.round(z / 2)}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    const height = getTerrainHeightAt(new THREE.Vector3(x, 0, z), originCoordinate, terrains);
    cache.set(key, height);
    return height;
  };
}

function ConstructionZoneItem({
  zone,
  track,
  terrainHeightAt,
  showLandscape,
  showSolids,
}: {
  zone: ConstructionZone;
  track?: Track | TransitionCurve;
  terrainHeightAt: TerrainHeightSampler;
  showLandscape: boolean;
  showSolids: boolean;
}) {
  const { selectedZoneId } = useSnapshot(constructionState);
  const isSelected = selectedZoneId === zone.id;

  const frames = useMemo(() => {
    if (!track) return [];
    return getConstructionFrames(track, zone, undefined, terrainHeightAt);
  }, [track, zone, terrainHeightAt]);

  const parts = useMemo(
    () => showLandscape ? createConstructionLandscapeParts(zone, frames, terrainHeightAt) : [],
    [zone, frames, terrainHeightAt, showLandscape],
  );

  const solids = useMemo<ConstructionSolids>(
    () => showSolids ? createConstructionSolids(frames) : {},
    [frames, showSolids],
  );

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    constructionState.originalZone = { ...store.data.constructionZones[zone.id] };
    constructionState.selectedZoneId = zone.id;
    constructionState.isEditingZone = true;
    guiState.selectedTab = "terrains";
  }, [zone.id]);

  if (frames.length < 2) return null;

  return (
    <group>
      {parts.map(part => (
        <mesh
          key={part.id}
          name={part.id}
          geometry={part.geometry}
          castShadow
          receiveShadow
          onClick={handleClick}
        >
          <meshStandardMaterial
            color={isSelected ? '#ffd28a' : part.color}
            emissive={isSelected ? '#2a1600' : '#000000'}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {solids.cut && (
        <mesh name="cutSolid" geometry={solids.cut}>
          <meshBasicMaterial
            color={CONSTRUCTION_PART_INFO.cutSolid.color}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {solids.fill && (
        <mesh name="fillSolid" geometry={solids.fill}>
          <meshBasicMaterial
            color={CONSTRUCTION_PART_INFO.fillSolid.color}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {solids.cut && (
        <mesh geometry={solids.cut}>
          <meshBasicMaterial
            color={CONSTRUCTION_PART_INFO.cutSolid.color}
            wireframe
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      )}

      {solids.fill && (
        <mesh geometry={solids.fill}>
          <meshBasicMaterial
            color={CONSTRUCTION_PART_INFO.fillSolid.color}
            wireframe
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

export default function ConstructionZones() {
  const constructionZones = useSnapshot(store.data.constructionZones);
  const originCoordinate = useSnapshot(store.data.originCoordinate);
  const terrains = useSnapshot(store.data.terrains);
  const tracks = useSnapshot(store.data.tracks);
  const { showConstructionZones, showConstructionSolids } = useSceneVisibility();

  const terrainHeightAt = useMemo(
    () => createTerrainSampler(originCoordinate as Position, terrains as never),
    [originCoordinate, terrains],
  );

  if (!constructionZones || Object.keys(constructionZones).length === 0) return null;
  if (!showConstructionZones && !showConstructionSolids) return null;

  return (
    <group>
      {Object.keys(constructionZones).map(id => (
        <ConstructionZoneItem
          key={id}
          zone={constructionZones[id]}
          track={constructionZones[id].trackId ? tracks[constructionZones[id].trackId] as Track | TransitionCurve : undefined}
          terrainHeightAt={terrainHeightAt}
          showLandscape={showConstructionZones}
          showSolids={showConstructionSolids}
        />
      ))}
    </group>
  );
}
