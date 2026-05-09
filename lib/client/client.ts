import { proxy } from "valtio";
import { MessageEmitter, store } from "../game";
import { updateTrainOnTime } from "../trains";
import { trainsTabPanelState } from "./trains";

export const clientState = proxy<{
  readyState: 0 | 1 | 2 | 3;
  isSynced: boolean;
  cameraFar: number;
  visibleFeatureCollections: string[];
  showSaveSuccess: boolean;
}>({
  readyState: WebSocket.CONNECTING,
  isSynced: false,
  cameraFar: 200000,
  visibleFeatureCollections: [],
  showSaveSuccess: false,
});

export const messageEmitter = new MessageEmitter();

export function updateClientOnTime(delta: number) {
}

export function getDate(timeZoneOffset: number) {
  return new Date(store.data.nowDate + timeZoneOffset);
}