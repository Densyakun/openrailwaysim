// 軌道3Dモデル・列車データのコピペ、ダウンロード、アップロード
import { store, deserialize, trainFormatTypeId } from './game';
import { TrackModel } from './tracks';
import { getSaveData, storeSaveData, ORSAppSaveDataType, SavedTrain } from './save';
import { SerializableTrainFormat, placeTrain } from './trains';

export type TrackModelExportData = {
  trackModels: { [trackId: string]: TrackModel[] };
  version: 1;
};

export type TrainExportData = {
  trainFormats: { [id: string]: SerializableTrainFormat };
  trains: { [id: string]: SavedTrain };
  version: 1;
};

export function exportTrackModels(): TrackModelExportData {
  const trackModels: { [trackId: string]: TrackModel[] } = {};

  Object.keys(store.data.tracks).forEach(trackId => {
    const track = store.data.tracks[trackId];
    if (track.trackModels.length > 0) {
      trackModels[trackId] = [...track.trackModels];
    }
  });

  return { trackModels, version: 1 };
}

export function importTrackModels(data: TrackModelExportData) {
  Object.keys(data.trackModels).forEach(trackId => {
    const track = store.data.tracks[trackId];
    if (track) {
      track.trackModels = data.trackModels[trackId];
    }
  });
}

export function exportTrains(): TrainExportData {
  const saveData = getSaveData();
  return {
    trainFormats: saveData.trainFormats,
    trains: saveData.trains,
    version: 1,
  };
}

export function importTrains(data: TrainExportData) {
  // Deserialize train formats and merge into store
  Object.keys(data.trainFormats).forEach(id => {
    const serialized = data.trainFormats[id];
    const deserialized = deserialize(trainFormatTypeId, serialized);
    store.data.trainFormats[id] = deserialized;
  });

  // Place trains
  Object.keys(data.trains).forEach(trainId => {
    const savedTrain = data.trains[trainId];
    const trainFormat = store.data.trainFormats[savedTrain.trainFormatId];
    if (!trainFormat) return;

    const result = placeTrain(
      trainFormat,
      savedTrain.pointOnTrack,
      savedTrain.directionIsReversed,
    );
    const train = result?.train;
    if (train) {
      train.trainFormatId = savedTrain.trainFormatId;
      train.cabStates = savedTrain.cabStates;
      train.speed = savedTrain.speed;
      train.currentDiagramId = savedTrain.currentDiagramId;
      train.currentDiagramCurveIndex = savedTrain.currentDiagramCurveIndex;
      train.currentDiagramSectionIndex = savedTrain.currentDiagramSectionIndex;
      train.currentRouteIndex = savedTrain.currentRouteIndex;
      train.isStopping = savedTrain.isStopping;
      store.data.trains[trainId] = train;
    }
  });
}

export function exportFullSave(): string {
  const saveData = getSaveData();
  return JSON.stringify(saveData, null, 2);
}

export function importFullSave(json: string) {
  const saveData: ORSAppSaveDataType = JSON.parse(json);
  storeSaveData(saveData);
}

export function downloadJSON(data: string, filename: string) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function uploadJSON(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const text = await file.text();
      resolve(text);
    };
    input.click();
  });
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export async function pasteFromClipboard(): Promise<string> {
  return await navigator.clipboard.readText();
}
