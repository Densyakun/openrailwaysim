/* eslint-disable @typescript-eslint/no-explicit-any */
// セーブデータに地形CSGキャッシュを事前計算して埋め込む
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import {
  createConstructionTerrainBrushes,
  createTunnelTerrainBrushes,
  ConstructionTerrainBrush,
} from '../lib/constructionTerrain';
import { evaluateTerrainCsg, SerializedCsgBrush } from '../lib/terrainCsg';
import { encodeTerrainCsgCacheEntry } from '../lib/terrainCsgCache';
import { createTerrainCsgKey } from '../lib/terrainCsgKey';
import { createTerrainNeighborEdges } from '../lib/terrainMesh';
import { getTerrainTileSize, getTileBounds, getTileMatrix } from '../lib/terrainTiles';

type SaveData = {
  originCoordinate: [number, number];
  terrains: { [tileY: string]: { [tileX: string]: (number | null)[][] } };
  tracks: { [key: string]: any };
  constructionZones?: { [key: string]: any };
  tunnels?: { [key: string]: any };
  includes?: string[];
};

const LOD_STEPS = [1, 2, 4, 8];
const NEAR_STEPS = new Set([1, 2]);

function deserializeTrack(raw: any) {
  const track: any = {
    ...raw,
    position: new THREE.Vector3(...raw.position),
    trackModels: raw.trackModels ?? [],
  };
  if (raw.endPosition) {
    track.endPosition = new THREE.Vector3(...raw.endPosition);
    track.transitionCurves = (raw.transitionCurves ?? []).map((segment: any) => ({
      ...segment,
      position: new THREE.Vector3(...segment.position),
    }));
  }
  return track;
}

function serializeGeometry(geometry: THREE.BufferGeometry): SerializedCsgBrush['cut'] {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  return {
    position: new Float32Array(position.array as ArrayLike<number>),
    uv: uv
      ? new Float32Array(uv.array as ArrayLike<number>)
      : new Float32Array(position.count * 2),
  };
}

function serializeBrush(brush: ConstructionTerrainBrush): SerializedCsgBrush {
  return {
    cut: brush.cut ? serializeGeometry(brush.cut) : undefined,
    fill: brush.fill ? serializeGeometry(brush.fill) : undefined,
  };
}

function writeStart(filePath: string) {
  fs.writeFileSync(filePath, '{"terrainCsgCache":{"version":1,"entries":[');
}

function appendEntry(filePath: string, entry: unknown, first: boolean) {
  fs.appendFileSync(filePath, `${first ? '' : ','}${JSON.stringify(entry)}`);
}

function writeEnd(filePath: string) {
  fs.appendFileSync(filePath, ']}}');
}

async function main() {
  const savePath = path.resolve(process.argv[2] ?? '../openrailwaysim-saves/yamanote.json');
  const save = JSON.parse(fs.readFileSync(savePath, 'utf8')) as SaveData;
  const directory = path.dirname(savePath);
  const baseName = path.basename(savePath, '.json');
  const nearPath = path.join(directory, `${baseName}.cache-near.json`);
  const farPath = path.join(directory, `${baseName}.cache-far.json`);

  const tracks: { [key: string]: any } = {};
  Object.keys(save.tracks ?? {}).forEach(id => {
    tracks[id] = deserializeTrack(save.tracks[id]);
  });

  const brushes = [
    ...createConstructionTerrainBrushes(
      save.constructionZones ?? {},
      tracks,
      save.originCoordinate,
      save.terrains ?? {},
    ),
    ...createTunnelTerrainBrushes(save.tunnels ?? {}, tracks),
  ];

  console.log(`save: ${savePath}`);
  console.log(`brushes: ${brushes.length}`);

  writeStart(nearPath);
  writeStart(farPath);
  let firstNear = true;
  let firstFar = true;
  let count = 0;

  for (const tileY of Object.keys(save.terrains ?? {})) {
    for (const tileX of Object.keys(save.terrains[tileY])) {
      const x = Number(tileX);
      const y = Number(tileY);
      const heightmap = save.terrains[tileY][tileX];
      if (!heightmap) continue;

      const bounds = getTileBounds(x, y, save.originCoordinate);
      const tileBrushes = brushes.filter(brush => brush.bounds.intersectsBox(bounds));
      if (tileBrushes.length === 0) continue;

      const eastHeightmap = save.terrains[tileY]?.[x + 1];
      const southHeightmap = save.terrains[y + 1]?.[x];
      const southeastHeightmap = save.terrains[y + 1]?.[x + 1];
      const terrainSize = getTerrainTileSize(y);
      const inverseMatrix = getTileMatrix(x, y, save.originCoordinate).invert().elements.slice();
      const edges = createTerrainNeighborEdges(eastHeightmap, southHeightmap, southeastHeightmap);
      const brushPayloads = tileBrushes.map(serializeBrush);
      const brushRefs = tileBrushes.map(brush => ({ id: brush.zoneId, signature: brush.signature }));

      for (const step of LOD_STEPS) {
        const key = createTerrainCsgKey({
          tileX: x,
          tileY: y,
          heightmap,
          eastHeightmap,
          southHeightmap,
          southeastHeightmap,
          step,
          brushes: brushRefs,
        });

        const startedAt = Date.now();
        let result;
        try {
          result = evaluateTerrainCsg(
            heightmap,
            terrainSize,
            inverseMatrix,
            brushPayloads,
            step,
            edges,
          );
        } catch (error) {
          console.error(`failed tile ${x}/${y} step ${step}:`, error);
          continue;
        }
        if (!result) {
          console.warn(`skipped tile ${x}/${y} step ${step}`);
          continue;
        }

        const entry = encodeTerrainCsgCacheEntry(key, result);
        if (NEAR_STEPS.has(step)) {
          appendEntry(nearPath, entry, firstNear);
          firstNear = false;
        } else {
          appendEntry(farPath, entry, firstFar);
          firstFar = false;
        }
        count += 1;
        console.log(`tile ${x}/${y} step ${step}: ${result.position.length / 3} verts (${Date.now() - startedAt} ms)`);
      }
    }
  }

  writeEnd(nearPath);
  writeEnd(farPath);

  const includes = new Set(save.includes ?? []);
  includes.add(`./${path.basename(nearPath)}`);
  includes.add(`./${path.basename(farPath)}`);
  save.includes = Array.from(includes);
  fs.writeFileSync(savePath, JSON.stringify(save));

  console.log(`wrote ${count} entries`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
