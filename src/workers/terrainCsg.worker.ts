/// <reference lib="webworker" />
import { HeightmapType } from '../../lib/terrain';
import { evaluateTerrainCsg, SerializedCsgBrush } from '../../lib/terrainCsg';

type BrushMessage = {
  type: 'brushes';
  revision: number;
  brushes: { zoneId: string; cut?: SerializedCsgBrush['cut']; fill?: SerializedCsgBrush['fill'] }[];
};

type JobMessage = {
  type: 'job';
  id: number;
  revision: number;
  heightmap: Float32Array;
  heightmapSize: number;
  terrainSize: number;
  inverseMatrix: number[];
  brushIds: string[];
};

type WorkerMessage = BrushMessage | JobMessage;

let revision = -1;
let brushes = new Map<string, SerializedCsgBrush>();

function deserializeHeightmap(values: Float32Array, size: number): HeightmapType {
  const heightmap: HeightmapType = [];
  for (let y = 0; y < size; y++) {
    const row: (number | null)[] = [];
    for (let x = 0; x < size; x++) {
      const value = values[y * size + x];
      row.push(Number.isNaN(value) ? null : value);
    }
    heightmap.push(row);
  }
  return heightmap;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'brushes') {
    revision = message.revision;
    brushes = new Map(message.brushes.map(brush => [
      brush.zoneId,
      { cut: brush.cut, fill: brush.fill },
    ]));
    return;
  }

  if (message.type === 'job') {
    if (message.revision !== revision) {
      self.postMessage({ type: 'result', id: message.id, revision: message.revision, skipped: true });
      return;
    }

    try {
      const heightmap = deserializeHeightmap(message.heightmap, message.heightmapSize);
      const selected = message.brushIds
        .map(id => brushes.get(id))
        .filter((brush): brush is SerializedCsgBrush => !!brush);

      const result = evaluateTerrainCsg(
        heightmap,
        message.terrainSize,
        message.inverseMatrix,
        selected,
      );

      if (!result) {
        self.postMessage({ type: 'result', id: message.id, revision: message.revision, skipped: true });
        return;
      }

      self.postMessage(
        { type: 'result', id: message.id, revision: message.revision, ...result },
        [result.position.buffer, result.uv.buffer, result.normal.buffer],
      );
    } catch (error) {
      self.postMessage({
        type: 'result',
        id: message.id,
        revision: message.revision,
        skipped: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
