// 造成ゾーンのソリッドを地形CSG用のブラシとして構築する
import * as THREE from 'three';
import { Position } from 'geojson';
import { ConstructionZone, createConstructionSolids, getConstructionFrames, TerrainHeightSampler } from './construction';
import { getTerrainHeightAt, HeightmapType } from './terrain';
import { Track, TransitionCurve } from './tracks';

export type ConstructionTerrainBrush = {
  zoneId: string;
  cut?: THREE.BufferGeometry;
  fill?: THREE.BufferGeometry;
  bounds: THREE.Box3;
};

export function createConstructionTerrainBrushes(
  zones: { [key: string]: ConstructionZone },
  tracks: { [key: string]: Track | TransitionCurve },
  originCoordinate: Position,
  terrains: { [key: string]: { [key: string]: HeightmapType } },
): ConstructionTerrainBrush[] {
  const zoneList = Object.values(zones).filter(zone => zone.trackId && zone.applyToTerrain !== false);
  if (zoneList.length === 0) return [];

  const cache = new Map<string, number | null>();
  const terrainHeightAt: TerrainHeightSampler = (x, z) => {
    const key = `${Math.round(x / 2)},${Math.round(z / 2)}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    const height = getTerrainHeightAt(new THREE.Vector3(x, 0, z), originCoordinate, terrains);
    cache.set(key, height);
    return height;
  };

  const brushes: ConstructionTerrainBrush[] = [];

  for (const zone of zoneList) {
    const track = tracks[zone.trackId];
    if (!track) continue;

    const frames = getConstructionFrames(track, zone, undefined, terrainHeightAt);
    if (frames.length < 2) continue;

    const solids = createConstructionSolids(frames);
    if (!solids.cut && !solids.fill) continue;

    const bounds = new THREE.Box3();
    for (const frame of frames) {
      for (const point of frame.points) bounds.expandByPoint(point);
    }
    bounds.expandByScalar(1);

    brushes.push({
      zoneId: zone.id,
      cut: solids.cut,
      fill: solids.fill,
      bounds,
    });
  }

  return brushes;
}
