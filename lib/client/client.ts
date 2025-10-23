import { proxy } from "valtio";
import { GameStateType, MessageEmitter, SaveDataType, getNewSaveData } from "../game";
import { updateTrainOnTime } from "../trains";
import { trainsTabPanelState } from "./trains";

export const gameState = proxy<GameStateType>({
  data: getNewSaveData(),
});

export const clientState = proxy<{
  readyState: 0 | 1 | 2 | 3;
  isSynced: boolean;
  cameraFar: number;
  visibleFeatureCollections: string[];
}>({
  readyState: WebSocket.CONNECTING,
  isSynced: false,
  cameraFar: 200000,
  visibleFeatureCollections: [],
});

export const messageEmitter = new MessageEmitter();

export function updateClientOnTime(saveData: SaveDataType, delta: number) {
  if (!trainsTabPanelState.editingTrain) return;

  updateTrainOnTime(saveData, trainsTabPanelState.editingTrain, delta);
}