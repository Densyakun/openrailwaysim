import { proxy } from 'valtio';
import type { HeightmapType } from '@/lib/terrain';
import { heightmapSize } from '@/lib/terrain';
import type { ConstructionTerrainBrush } from '@/lib/constructionTerrain';
import {
  evaluateTerrainCsg,
  SerializedCsgBrush,
  SerializedGeometry,
  SerializedTerrainCsgResult,
} from '@/lib/terrainCsg';
import {
  getCachedTerrainCsg,
  pruneCachedTerrainCsg,
  setCachedTerrainCsg,
} from '@/lib/terrainCsgCache';
import { createTerrainCsgKey } from '@/lib/terrainCsgKey';

export const terrainCsgRevisionState = proxy<{ revision: number }>({
  revision: 0,
});

export const terrainCsgProgressState = proxy<{
  pending: number;
  running: number;
  completed: number;
  total: number;
  isProcessing: boolean;
  error: string;
}>({
  pending: 0,
  running: 0,
  completed: 0,
  total: 0,
  isProcessing: false,
  error: '',
});

export type TerrainCsgBrushRef = {
  id: string;
  signature: string;
};

export type TerrainCsgRequest = {
  tileX: number;
  tileY: number;
  heightmap: HeightmapType;
  eastHeightmap?: HeightmapType;
  southHeightmap?: HeightmapType;
  southeastHeightmap?: HeightmapType;
  terrainSize: number;
  step: number;
  inverseMatrix: number[];
  brushes: TerrainCsgBrushRef[];
};

type WorkerResultMessage = {
  type: 'result';
  id: number;
  revision: number;
  skipped?: boolean;
  error?: string;
  position?: Float32Array;
  uv?: Float32Array;
  normal?: Float32Array;
};

type Job = {
  id: number;
  key: string;
  revision: number;
  heightmap: Float32Array;
  eastEdge: Float32Array;
  southEdge: Float32Array;
  southeastCorner: number;
  terrainSize: number;
  step: number;
  inverseMatrix: number[];
  brushIds: string[];
  resolve: (result: SerializedTerrainCsgResult | null) => void;
};

type WorkerSlot = {
  worker: Worker;
  job?: Job;
};

const slots: WorkerSlot[] = [];
let queue: Job[] = [];
let nextJobId = 1;
let revision = 0;
let nextRevision = 0;
const currentBrushes = new Map<string, SerializedCsgBrush>();
const publishedBrushSignatures = new Map<string, string>();

const inflight = new Map<string, Promise<SerializedTerrainCsgResult | null>>();

function serializeGeometry(geometry: import('three').BufferGeometry): SerializedGeometry {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  return {
    position: new Float32Array(position.array as ArrayLike<number>),
    uv: uv
      ? new Float32Array(uv.array as ArrayLike<number>)
      : new Float32Array(position.count * 2),
  };
}


function serializeHeightmap(heightmap: HeightmapType) {
  const values = new Float32Array(heightmapSize * heightmapSize);
  for (let y = 0; y < heightmapSize; y++) {
    for (let x = 0; x < heightmapSize; x++) {
      const value = heightmap[y]?.[x] ?? null;
      values[y * heightmapSize + x] = value === null ? NaN : value;
    }
  }
  return values;
}

function serializeEdge(
  heightmap: HeightmapType | undefined,
  getValue: (heightmap: HeightmapType, index: number) => number | null | undefined,
) {
  const values = new Float32Array(heightmapSize);
  for (let index = 0; index < heightmapSize; index++) {
    const value = heightmap ? getValue(heightmap, index) : null;
    values[index] = value === null || value === undefined ? NaN : value;
  }
  return values;
}

function updateProgress() {
  terrainCsgProgressState.pending = queue.length;
  terrainCsgProgressState.running = slots.filter(slot => slot.job).length;
  terrainCsgProgressState.isProcessing =
    terrainCsgProgressState.pending > 0 || terrainCsgProgressState.running > 0;
}

function resetProgress() {
  terrainCsgProgressState.pending = 0;
  terrainCsgProgressState.running = slots.filter(slot => slot.job).length;
  terrainCsgProgressState.completed = 0;
  terrainCsgProgressState.total = 0;
  terrainCsgProgressState.error = '';
  updateProgress();
}

function finishJobProgress() {
  terrainCsgProgressState.completed = Math.min(
    terrainCsgProgressState.total,
    terrainCsgProgressState.completed + 1,
  );
  updateProgress();
}

function dispatch() {
  for (const slot of slots) {
    if (slot.job) continue;
    const job = queue.shift();
    if (!job) break;

    slot.job = job;
    updateProgress();

    slot.worker.postMessage({
      type: 'job',
      id: job.id,
      revision: job.revision,
      heightmap: job.heightmap,
      eastEdge: job.eastEdge,
      southEdge: job.southEdge,
      southeastCorner: job.southeastCorner,
      heightmapSize,
      terrainSize: job.terrainSize,
      step: job.step,
      inverseMatrix: job.inverseMatrix,
      brushIds: job.brushIds,
    }, [job.heightmap.buffer, job.eastEdge.buffer, job.southEdge.buffer]);
  }

  updateProgress();
}

function handleResult(slot: WorkerSlot, message: WorkerResultMessage) {
  const job = slot.job;
  if (!job || job.id !== message.id) return;

  slot.job = undefined;

  if (message.revision !== revision) {
    job.resolve(null);
    dispatch();
    return;
  }

  if (message.skipped || !message.position || !message.uv || !message.normal) {
    if (message.error) terrainCsgProgressState.error = message.error;
    job.resolve(null);
    finishJobProgress();
    dispatch();
    return;
  }

  const result: SerializedTerrainCsgResult = {
    position: message.position,
    uv: message.uv,
    normal: message.normal,
  };
  setCachedTerrainCsg(job.key, result);
  job.resolve(result);
  finishJobProgress();
  dispatch();
}

function createWorkerSlot() {
  const worker = new Worker(new URL('./terrainCsg.worker.ts', import.meta.url), { type: 'module' });
  const slot: WorkerSlot = { worker };

  worker.onmessage = (event: MessageEvent<WorkerResultMessage>) => {
    handleResult(slot, event.data);
  };

  worker.onerror = () => {
    const job = slot.job;
    slot.job = undefined;
    if (job) {
      job.resolve(null);
      if (job.revision === revision) finishJobProgress();
    }
    dispatch();
  };

  return slot;
}

function ensureWorkers() {
  if (slots.length > 0) return;
  if (typeof Worker === 'undefined') return;

  const hardwareConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4;
  const count = Math.max(1, Math.min(4, hardwareConcurrency - 1));

  for (let index = 0; index < count; index++) {
    try {
      slots.push(createWorkerSlot());
    } catch {
      break;
    }
  }
}

function pruneCacheForZone(zoneId: string, signature?: string) {
  const needle = signature === undefined ? `${zoneId}@` : `${zoneId}@${signature};`;
  pruneCachedTerrainCsg(key => key.includes(needle));
}

export function publishTerrainCsgBrushes(brushes: ConstructionTerrainBrush[]) {
  const nextBrushMap = new Map(brushes.map(brush => [brush.zoneId, brush]));
  const changed: ConstructionTerrainBrush[] = [];
  const removedIds: string[] = [];

  for (const brush of brushes) {
    const publishedSignature = publishedBrushSignatures.get(brush.zoneId);
    if (publishedSignature !== brush.signature) changed.push(brush);
  }

  for (const zoneId of publishedBrushSignatures.keys()) {
    if (!nextBrushMap.has(zoneId)) removedIds.push(zoneId);
  }

  if (changed.length === 0 && removedIds.length === 0) return revision;

  revision = ++nextRevision;

  for (const job of queue) job.resolve(null);
  queue = [];
  inflight.clear();

  for (const brush of changed) {
    const oldSignature = publishedBrushSignatures.get(brush.zoneId);
    if (oldSignature !== undefined) pruneCacheForZone(brush.zoneId, oldSignature);
    publishedBrushSignatures.set(brush.zoneId, brush.signature);
    currentBrushes.set(brush.zoneId, {
      cut: brush.cut ? serializeGeometry(brush.cut) : undefined,
      fill: brush.fill ? serializeGeometry(brush.fill) : undefined,
    });
  }

  for (const zoneId of removedIds) {
    publishedBrushSignatures.delete(zoneId);
    currentBrushes.delete(zoneId);
    pruneCacheForZone(zoneId);
  }

  if (currentBrushes.size > 0) ensureWorkers();

  const changedPayload = changed
    .map(brush => ({
      zoneId: brush.zoneId,
      cut: currentBrushes.get(brush.zoneId)?.cut,
      fill: currentBrushes.get(brush.zoneId)?.fill,
    }));

  for (const slot of slots) {
    slot.worker.postMessage({
      type: 'updateBrushes',
      revision,
      brushes: changedPayload,
      removeIds: removedIds,
    });
  }

  resetProgress();
  terrainCsgRevisionState.revision = revision;
  return revision;
}

export function requestTerrainCsg(params: TerrainCsgRequest): Promise<SerializedTerrainCsgResult | null> {
  const key = createTerrainCsgKey({
    tileX: params.tileX,
    tileY: params.tileY,
    heightmap: params.heightmap,
    eastHeightmap: params.eastHeightmap,
    southHeightmap: params.southHeightmap,
    southeastHeightmap: params.southeastHeightmap,
    step: params.step,
    brushes: params.brushes,
  });

  const cached = getCachedTerrainCsg(key);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  const brushIds = params.brushes.map(brush => brush.id);

  if (slots.length === 0) {
    const selected = brushIds
      .map(id => currentBrushes.get(id))
      .filter((brush): brush is SerializedCsgBrush => !!brush);
    try {
      const result = evaluateTerrainCsg(
        params.heightmap,
        params.terrainSize,
        params.inverseMatrix,
        selected,
        params.step,
        {
          east: params.eastHeightmap ? serializeEdge(params.eastHeightmap, (heightmap, index) => heightmap[index]?.[0]) : undefined,
          south: params.southHeightmap ? serializeEdge(params.southHeightmap, (heightmap, index) => heightmap[0]?.[index]) : undefined,
          southeast: params.southeastHeightmap?.[0]?.[0] ?? undefined,
        },
      );
      if (result) setCachedTerrainCsg(key, result);
      return Promise.resolve(result);
    } catch {
      return Promise.resolve(null);
    }
  }

  const promise = new Promise<SerializedTerrainCsgResult | null>(resolve => {
    const job: Job = {
      id: nextJobId++,
      key,
      revision,
      heightmap: serializeHeightmap(params.heightmap),
      eastEdge: serializeEdge(params.eastHeightmap, (heightmap, index) => heightmap[index]?.[0]),
      southEdge: serializeEdge(params.southHeightmap, (heightmap, index) => heightmap[0]?.[index]),
      southeastCorner: params.southeastHeightmap?.[0]?.[0] ?? NaN,
      terrainSize: params.terrainSize,
      step: params.step,
      inverseMatrix: params.inverseMatrix,
      brushIds,
      resolve,
    };

    terrainCsgProgressState.total += 1;
    queue.push(job);
    updateProgress();
    dispatch();
  });

  inflight.set(key, promise);
  void promise.finally(() => inflight.delete(key));
  return promise;
}
