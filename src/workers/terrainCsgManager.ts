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
  terrainSize: number;
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
let currentBrushes = new Map<string, SerializedCsgBrush>();

const cache = new Map<string, SerializedTerrainCsgResult>();
const inflight = new Map<string, Promise<SerializedTerrainCsgResult | null>>();
const heightmapIds = new WeakMap<object, number>();
let nextHeightmapId = 1;

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

function getHeightmapId(heightmap: HeightmapType) {
  let id = heightmapIds.get(heightmap as object);
  if (id === undefined) {
    id = nextHeightmapId++;
    heightmapIds.set(heightmap as object, id);
  }
  return id;
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

function updateProgress() {
  terrainCsgProgressState.pending = queue.length;
  terrainCsgProgressState.running = slots.filter(slot => slot.job).length;
  terrainCsgProgressState.isProcessing =
    terrainCsgProgressState.pending > 0 || terrainCsgProgressState.running > 0;
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
      heightmapSize,
      terrainSize: job.terrainSize,
      inverseMatrix: job.inverseMatrix,
      brushIds: job.brushIds,
    }, [job.heightmap.buffer]);
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
  cache.set(job.key, result);
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

export function publishTerrainCsgBrushes(brushes: ConstructionTerrainBrush[]) {
  revision = ++nextRevision;
  cache.clear();
  inflight.clear();

  for (const job of queue) job.resolve(null);
  queue = [];

  if (brushes.length === 0) {
    currentBrushes = new Map();
    terrainCsgProgressState.pending = 0;
    terrainCsgProgressState.running = slots.filter(slot => slot.job).length;
    terrainCsgProgressState.completed = 0;
    terrainCsgProgressState.total = 0;
    terrainCsgProgressState.error = '';
    updateProgress();
    terrainCsgRevisionState.revision = revision;
    return revision;
  }

  ensureWorkers();

  currentBrushes = new Map();

  const payload = brushes.map(brush => {
    const serialized: SerializedCsgBrush = {
      cut: brush.cut ? serializeGeometry(brush.cut) : undefined,
      fill: brush.fill ? serializeGeometry(brush.fill) : undefined,
    };
    currentBrushes.set(brush.zoneId, serialized);
    return {
      zoneId: brush.zoneId,
      cut: serialized.cut,
      fill: serialized.fill,
    };
  });

  for (const slot of slots) {
    slot.worker.postMessage({ type: 'brushes', revision, brushes: payload });
  }

  terrainCsgProgressState.pending = 0;
  terrainCsgProgressState.running = slots.filter(slot => slot.job).length;
  terrainCsgProgressState.completed = 0;
  terrainCsgProgressState.total = 0;
  terrainCsgProgressState.error = '';
  updateProgress();

  terrainCsgRevisionState.revision = revision;
  return revision;
}

export function requestTerrainCsg(params: {
  tileX: number;
  tileY: number;
  heightmap: HeightmapType;
  terrainSize: number;
  inverseMatrix: number[];
  brushIds: string[];
}): Promise<SerializedTerrainCsgResult | null> {
  const key = [
    params.tileX,
    params.tileY,
    revision,
    getHeightmapId(params.heightmap),
    params.brushIds.join(','),
  ].join(':');

  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  if (slots.length === 0) {
    const selected = params.brushIds
      .map(id => currentBrushes.get(id))
      .filter((brush): brush is SerializedCsgBrush => !!brush);
    try {
      return Promise.resolve(evaluateTerrainCsg(
        params.heightmap,
        params.terrainSize,
        params.inverseMatrix,
        selected,
      ));
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
      terrainSize: params.terrainSize,
      inverseMatrix: params.inverseMatrix,
      brushIds: params.brushIds,
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
