import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Feature, Position } from 'geojson'
import { useFrame, useThree } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { store } from '@/lib/game'
import { buildingGenerationSettings } from '@/lib/client/buildings'
import { BuildingSourceEntry, buildBuildingGeometryData } from '@/lib/buildings'
import { useSceneVisibility } from '@/lib/client/sceneVisibility'
import { getBuildingMaterials } from './buildingTextures'

const BUILDING_VISIBLE_DISTANCE = 1500;

function getFeatureRepresentativeCoordinate(feature: Feature): Position | undefined {
  const geometry = feature.geometry;

  switch (geometry.type) {
    case "Point":
      return geometry.coordinates;
    case "MultiPoint":
    case "LineString":
      return geometry.coordinates[0];
    case "MultiLineString":
    case "Polygon":
      return geometry.coordinates[0]?.[0];
    case "MultiPolygon":
      return geometry.coordinates[0]?.[0]?.[0];
    default:
      return undefined;
  }
}

function getFeatureLocalPosition(feature: Feature, originCoordinate: Position) {
  const coordinate = getFeatureRepresentativeCoordinate(feature);
  if (!coordinate) return undefined;

  const longitudeScale = 111320 * Math.cos(originCoordinate[1] * Math.PI / 180);
  return {
    x: (coordinate[0] - originCoordinate[0]) * longitudeScale,
    z: -(coordinate[1] - originCoordinate[1]) * 111320,
  };
}

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
 * 蟒ｺ迚ｩ Polygon 縺九ｉ逕滓・縺励◆螢√・螻区ｹ繝ｻ蝓ｺ遉弱Γ繝・す繝･縲・ * 蟒ｺ迚ｩ縺斐→縺ｫ繧ｪ繝悶ず繧ｧ繧ｯ繝医ｒ菴懊ｉ縺壹∫ｨｮ鬘槭＃縺ｨ縺ｫ 1 縺､縺ｮ繝｡繝・す繝･縺ｸ邨仙粋縺励※縺・ｋ縲・ */
export function BuildingMeshes({ entries }: { entries: BuildingSourceEntry[] }) {
  const { originCoordinate, terrains } = useSnapshot(store.data);
  const invalidate = useThree(state => state.invalidate);
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

  useEffect(() => {
    invalidate();
  }, [data, geometries, materials, invalidate]);

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
 * 陦ｨ遉ｺ荳ｭ縺ｮ Feature collection 縺ｫ蜷ｫ縺ｾ繧後ｋ蟒ｺ迚ｩ繧・3D 陦ｨ遉ｺ縺吶ｋ縲・ */
export default function Buildings() {
  const { showBuildings } = useSceneVisibility();
  const featureCollections = useSnapshot(store.data.featureCollections);
  const { originCoordinate } = useSnapshot(store.data);
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const [cameraPosition, setCameraPosition] = useState(() => camera.position.clone());
  const lastCameraCheck = useRef(0);

  useEffect(() => {
    setCameraPosition(camera.position.clone());
    invalidate();
  }, [camera, featureCollections, invalidate]);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastCameraCheck.current < 0.5) return;
    lastCameraCheck.current = clock.elapsedTime;

    if (camera.position.distanceToSquared(cameraPosition) < 200 ** 2) return;

    setCameraPosition(camera.position.clone());
    invalidate();
  });

  const allEntries = useMemo<BuildingSourceEntry[]>(
    () => Object.keys(featureCollections).map(id => ({
      id,
      value: featureCollections[id].value as BuildingSourceEntry["value"],
    })),
    [featureCollections],
  );

  const entries = useMemo<BuildingSourceEntry[]>(() => {
    if (!showBuildings) return [];

    return allEntries.map(entry => ({
      id: entry.id,
      value: {
        ...entry.value,
        features: entry.value.features.filter(feature => {
          const position = getFeatureLocalPosition(feature, originCoordinate as Position);
          if (!position) return false;

          return Math.hypot(
            position.x - cameraPosition.x,
            position.z - cameraPosition.z,
          ) <= BUILDING_VISIBLE_DISTANCE;
        }),
      },
    })).filter(entry => entry.value.features.length > 0);
  }, [allEntries, cameraPosition, originCoordinate, showBuildings]);

  useEffect(() => {
    invalidate();
  }, [entries, showBuildings, invalidate]);

  if (!showBuildings) return null;

  return <BuildingMeshes entries={entries} />;
}
