import { proxy } from 'valtio';

export const saveLoadState = proxy<{
  active: boolean;
  title: string;
  message: string;
  detail: string;
}>({
  active: false,
  title: '',
  message: '',
  detail: '',
});

let autoFinishTimeout: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

function scheduleAutoFinish() {
  if (autoFinishTimeout !== undefined) clearTimeout(autoFinishTimeout);
  const currentGeneration = generation;
  autoFinishTimeout = setTimeout(() => {
    autoFinishTimeout = undefined;
    if (currentGeneration === generation) saveLoadState.active = false;
  }, 30_000);
}

export function beginSaveLoad(message: string, detail = '') {
  generation += 1;
  saveLoadState.active = true;
  saveLoadState.title = 'セーブデータを読み込み中';
  saveLoadState.message = message;
  saveLoadState.detail = detail;
  scheduleAutoFinish();
}

export function updateSaveLoad(message: string, detail = '') {
  saveLoadState.active = true;
  saveLoadState.message = message;
  saveLoadState.detail = detail;
  scheduleAutoFinish();
}

export function finishSaveLoad() {
  if (autoFinishTimeout !== undefined) clearTimeout(autoFinishTimeout);
  autoFinishTimeout = undefined;
  saveLoadState.active = false;
}

export function finishSaveLoadAfter(delayMilliseconds: number) {
  const currentGeneration = generation;
  setTimeout(() => {
    if (currentGeneration === generation) finishSaveLoad();
  }, delayMilliseconds);
}
