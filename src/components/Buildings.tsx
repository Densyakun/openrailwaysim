import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { Position } from 'geojson'
import { useSnapshot } from 'valtio'
import { store } from '@/lib/game'
import { featureCollectionViewState } from '@/lib/client/featureCollections'
import { buildingGenerationSettings } from '@/lib/client/buildings'
import { BuildingSourceEntry, buildBuildingGeometryData } from '@/lib/buildings'
import { useVisibleFeatureCollectionEntries } from './useVisibleFeatureCollectionEntries'
import { getBuildingMaterials } from './buildingTextures'

function createGeometry(
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  colors: Float32Array,
) {
  if (!positions.length || !normals.length || !uvs.length || !colors.length) return undefined;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}

/**
 * 建物 Polygon から生成した壁・屋根・基礎メッシュ。
 * 建物ごとにオブジェクトを作らず、種類ごとに 1 つのメッシュへ結合している。
 */
export function BuildingMeshes({ entries }: { entries: BuildingSourceEntry[] }) {
  const { originCoordinate, terrains } = useSnapshot(store.data);
  const {
    followTerrain, foundationDepth, floorHeight, seed, variation,
  } = useSnapshot(buildingGenerationSettings);

  const data = useMemo(
    () => entries.length
      ? buildBuildingGeometryData(entries, originCoordinate as Position, {
        followTerrain,
        foundationDepth,
        floorHeight,
        seed,
        variation,
        terrains: terrains as never,
      })
      : undefined,
    [entries, originCoordinate, terrains, followTerrain, foundationDepth, floorHeight, seed, variation],
  );

  const geometries = useMemo(() => data ? {
    wall: createGeometry(data.wallPositions, data.wallNormals, data.wallUvs, data.wallColors),
    roof: createGeometry(data.roofPositions, data.roofNormals, data.roofUvs, data.roofColors),
    foundation: createGeometry(
      data.foundationPositions,
      data.foundationNormals,
      data.foundationUvs,
      data.foundationColors,
    ),
  } : undefined, [data]);

  const materials = useMemo(
    () => data?.buildingCount ? getBuildingMaterials() : undefined,
    [data?.buildingCount],
  );

  useEffect(() => () => {
    geometries?.wall?.dispose();
    geometries?.roof?.dispose();
    geometries?.foundation?.dispose();
  }, [geometries]);

  if (!data?.buildingCount || !geometries?.wall || !geometries?.roof || !materials) return null;

  return <>
    <mesh geometry={geometries.wall} material={materials.wall} />
    <mesh geometry={geometries.roof} material={materials.roof} />
    {geometries.foundation ? <mesh geometry={geometries.foundation} material={materials.foundation} /> : null}
  </>;
}

/**
 * 表示中の Feature collection に含まれる建物を 3D 表示する。
 */
export default function Buildings() {
  const { showBuildings } = useSnapshot(featureCollectionViewState);
  const entries = useVisibleFeatureCollectionEntries();

  if (!showBuildings) return null;

  return <BuildingMeshes entries={entries} />;
}
