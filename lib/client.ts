import { proxy } from "valtio";
import { GameStateType, MessageEmitter, getNewState } from "./game";
import { updateTrainOnTime } from "./trains";
import { trainsTabPanelState } from "./client/trains";

export const gameState = getNewState();

export const clientState = proxy<{
  isSynced: boolean;
  cameraFar: number;
}>({
  isSynced: false,
  cameraFar: 200000,
});

export const messageEmitter = new MessageEmitter();

export function updateClientOnTime(gameState: GameStateType, delta: number) {
  if (!trainsTabPanelState.editingTrain) return;

  updateTrainOnTime(gameState, trainsTabPanelState.editingTrain, delta);
}