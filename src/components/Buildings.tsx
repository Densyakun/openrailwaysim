import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { Position } from 'geojson'
import { useSnapshot } from 'valtio'
import { store } from '@/lib/game'
import { featureCollectionViewState } from '@/lib/client/featureCollections'
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
 * 建物 Polygon から生成した壁・屋根メッシュ。
 * 建物ごとにオブジェクトを作らず、1 つの壁メッシュと 1 つの屋根メッシュに結合している。
 */
export function BuildingMeshes({ entries }: { entries: BuildingSourceEntry[] }) {
  const { originCoordinate } = useSnapshot(store.data);

  const data = useMemo(
    () => entries.length
      ? buildBuildingGeometryData(entries, originCoordinate as Position)
      : undefined,
    [entries, originCoordinate],
  );

  const geometries = useMemo(() => data ? {
    wall: createGeometry(data.wallPositions, data.wallNormals, data.wallUvs, data.wallColors),
    roof: createGeometry(data.roofPositions, data.roofNormals, data.roofUvs, data.roofColors),
  } : undefined, [data]);

  const materials = useMemo(
    () => data?.buildingCount ? getBuildingMaterials() : undefined,
    [data?.buildingCount],
  );

  useEffect(() => () => {
    geometries?.wall?.dispose();
    geometries?.roof?.dispose();
  }, [geometries]);

  if (!data?.buildingCount || !geometries?.wall || !geometries?.roof || !materials) return null;

  return <>
    <mesh geometry={geometries.wall} material={materials.wall} />
    <mesh geometry={geometries.roof} material={materials.roof} />
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
