import { proxy } from "valtio";
import { GameStateType, MessageEmitter, SaveDataType, getNewSaveData } from "./game";
import { updateTrainOnTime } from "./trains";
import { trainsTabPanelState } from "./client/trains";

export const gameState = proxy<GameStateType>({
  data: getNewSaveData(),
});

export const clientState = proxy<{
  isSynced: boolean;
  cameraFar: number;
}>({
  isSynced: false,
  cameraFar: 200000,
});

export const messageEmitter = new MessageEmitter();

export function updateClientOnTime(saveData: SaveDataType, delta: number) {
  if (!trainsTabPanelState.editingTrain) return;

  updateTrainOnTime(saveData, trainsTabPanelState.editingTrain, delta);
}