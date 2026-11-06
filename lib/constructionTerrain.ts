// 造成ゾーンのソリッドを地形CSG用のブラシとして構築する
import * as THREE from 'three';
import { Position } from 'geojson';
import { ConstructionZone, createConstructionSolids, getConstructionFrames, TerrainHeightSampler } from './construction';
import { getTerrainHeightAt, HeightmapType } from './terrain';
import { Track, TransitionCurve } from './tracks';
import { Tunnel, createTunnelCSGVolumes } from './tunnel';

export type ConstructionTerrainBrush = {
  zoneId: string;
  cut?: THREE.BufferGeometry;
  fill?: THREE.BufferGeometry;
  bounds: THREE.Box3;
  signature: string;
};

type CachedZoneBrush = {
  zone: ConstructionZone;
  track: Track | TransitionCurve;
  brush: ConstructionTerrainBrush | null;
};

type CachedTunnelBrush = {
  tunnel: Tunnel;
  track: Track | TransitionCurve;
  brush: ConstructionTerrainBrush | null;
};

const zoneBrushCache = new Map<string, CachedZoneBrush>();
const tunnelBrushCache = new Map<string, CachedTunnelBrush>();
let cachedTerrainSource: object | undefined;
let cachedOriginKey = '';

function hashGeometry(geometry: THREE.BufferGeometry | undefined) {
  if (!geometry) return '0';

  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let hash = 2166136261;

  for (let index = 0; index < position.array.length; index++) {
    hash ^= Math.round((position.array as ArrayLike<number>)[index] * 1000);
    hash = Math.imul(hash, 16777619);
  }

  if (uv) {
    for (let index = 0; index < uv.array.length; index++) {
      hash ^= Math.round((uv.array as ArrayLike<number>)[index] * 1000);
      hash = Math.imul(hash, 16777619);
    }
  }

  hash ^= position.count;
  hash = Math.imul(hash, 16777619);
  return (hash >>> 0).toString(36);
}

function createBrushSignature(cut?: THREE.BufferGeometry, fill?: THREE.BufferGeometry) {
  return `${hashGeometry(cut)}:${hashGeometry(fill)}`;
}

function disposeBrush(brush: ConstructionTerrainBrush | null | undefined) {
  brush?.cut?.dispose();
  brush?.fill?.dispose();
}

function clearCache() {
  for (const cached of zoneBrushCache.values()) disposeBrush(cached.brush);
  zoneBrushCache.clear();
}

export function createConstructionTerrainBrushes(
  zones: { [key: string]: ConstructionZone },
  tracks: { [key: string]: Track | TransitionCurve },
  originCoordinate: Position,
  terrains: { [key: string]: { [key: string]: HeightmapType } },
): ConstructionTerrainBrush[] {
  const terrainSource = terrains as object;
  const originKey = `${originCoordinate[0]},${originCoordinate[1]}`;

  if (terrainSource !== cachedTerrainSource || originKey !== cachedOriginKey) {
    clearCache();
    cachedTerrainSource = terrainSource;
    cachedOriginKey = originKey;
  }

  const zoneList = Object.values(zones).filter(zone => zone.trackId && zone.applyToTerrain !== false);
  const activeZoneIds = new Set(zoneList.map(zone => zone.id));

  for (const [zoneId, cached] of zoneBrushCache) {
    if (!activeZoneIds.has(zoneId)) {
      disposeBrush(cached.brush);
      zoneBrushCache.delete(zoneId);
    }
  }

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
    if (!track) {
      const cached = zoneBrushCache.get(zone.id);
      if (cached) {
        disposeBrush(cached.brush);
        zoneBrushCache.delete(zone.id);
      }
      continue;
    }

    const cached = zoneBrushCache.get(zone.id);
    if (cached && cached.zone === zone && cached.track === track) {
      if (cached.brush) brushes.push(cached.brush);
      continue;
    }

    disposeBrush(cached?.brush);

    const frames = getConstructionFrames(track, zone, undefined, terrainHeightAt);
    if (frames.length < 2) {
      zoneBrushCache.set(zone.id, { zone, track, brush: null });
      continue;
    }

    const solids = createConstructionSolids(frames);
    if (!solids.cut && !solids.fill) {
      zoneBrushCache.set(zone.id, { zone, track, brush: null });
      continue;
    }

    const bounds = new THREE.Box3();
    for (const frame of frames) {
      for (const point of frame.points) bounds.expandByPoint(point);
    }
    bounds.expandByScalar(1);

    const brush: ConstructionTerrainBrush = {
      zoneId: zone.id,
      cut: solids.cut,
      fill: solids.fill,
      bounds,
      signature: createBrushSignature(solids.cut, solids.fill),
    };

    zoneBrushCache.set(zone.id, { zone, track, brush });
    brushes.push(brush);
  }

  return brushes;
}

export function createTunnelTerrainBrushes(
  tunnels: { [key: string]: Tunnel },
  tracks: { [key: string]: Track | TransitionCurve },
): ConstructionTerrainBrush[] {
  const tunnelList = Object.values(tunnels).filter(tunnel =>
    tunnel.trackId && tunnel.applyToTerrain !== false
  );
  const activeIds = new Set(tunnelList.map(tunnel => tunnel.id));

  for (const [tunnelId, cached] of tunnelBrushCache) {
    if (!activeIds.has(tunnelId)) {
      disposeBrush(cached.brush);
      tunnelBrushCache.delete(tunnelId);
    }
  }

  const brushes: ConstructionTerrainBrush[] = [];

  for (const tunnel of tunnelList) {
    const track = tracks[tunnel.trackId];
    if (!track) {
      const cached = tunnelBrushCache.get(tunnel.id);
      if (cached) {
        disposeBrush(cached.brush);
        tunnelBrushCache.delete(tunnel.id);
      }
      continue;
    }

    const cached = tunnelBrushCache.get(tunnel.id);
    if (cached && cached.tunnel === tunnel && cached.track === track) {
      if (cached.brush) brushes.push(cached.brush);
      continue;
    }

    disposeBrush(cached?.brush);

    const volumes = createTunnelCSGVolumes(
      track,
      tunnel.startLength,
      tunnel.endLength,
      tunnel.crossSection,
      tunnel.extendSides,
      tunnel.extendBottom,
    );
    const indexed = volumes.cutVolume;
    const cut = indexed.index ? indexed.toNonIndexed() : indexed;
    if (indexed !== cut) indexed.dispose();

    if (!cut.getAttribute('position')?.count) {
      cut.dispose();
      tunnelBrushCache.set(tunnel.id, { tunnel, track, brush: null });
      continue;
    }

    cut.computeBoundingBox();
    const bounds = cut.boundingBox?.clone() ?? new THREE.Box3();
    bounds.expandByScalar(1);

    const brush: ConstructionTerrainBrush = {
      zoneId: `tunnel:${tunnel.id}`,
      cut,
      bounds,
      signature: createBrushSignature(cut),
    };

    tunnelBrushCache.set(tunnel.id, { tunnel, track, brush });
    brushes.push(brush);
  }

  return brushes;
}

export function clearConstructionTerrainBrushCache() {
  clearCache();
  for (const cached of tunnelBrushCache.values()) disposeBrush(cached.brush);
  tunnelBrushCache.clear();
  cachedTerrainSource = undefined;
  cachedOriginKey = '';
}
