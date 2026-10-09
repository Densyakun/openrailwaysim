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
  username: string;
  connectionPassword: string;
  isAuthenticated: boolean;
  passwordRequired: boolean;
  isAdmin: boolean;
  adminPasswordRequired: boolean;
  saves: string[];
  currentSave: string;
  users: { id: string; username: string }[];
  enableBloom: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
}>({
  readyState: WebSocket.CONNECTING,
  isSynced: false,
  cameraFar: 200000,
  visibleFeatureCollections: [],
  showSaveSuccess: false,
  username: "",
  connectionPassword: "",
  isAuthenticated: false,
  passwordRequired: false,
  isAdmin: false,
  adminPasswordRequired: false,
  saves: [],
  currentSave: "",
  users: [],
  enableBloom: false,
  bloomStrength: 0.6,
  bloomRadius: 0.4,
  bloomThreshold: 0.85,
});

export const messageEmitter = new MessageEmitter();

export function updateClientOnTime(delta: number) {
}

export function getDate(timeZoneOffset: number) {
  return new Date(store.data.nowDate + timeZoneOffset);
}