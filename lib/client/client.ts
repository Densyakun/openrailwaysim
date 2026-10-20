import { proxy } from "valtio";
import { MessageEmitter, store } from "../game";
import { isLocalMode } from "./localMode";

export type LoginStatus = "idle" | "connecting" | "authenticating" | "connected" | "failed";

export const SERVER_URL_STORAGE_KEY = "ors.serverUrl";

export function getDefaultServerUrl() {
  const protocol = typeof location !== "undefined" && location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = typeof location !== "undefined" ? location.hostname : "localhost";
  return `${protocol}//${hostname}:8080/ws`;
}

const startInLocalMode = isLocalMode();

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
  serverUrl: string;
  localMode: boolean;
  isStarted: boolean;
  loginOpen: boolean;
  loginStatus: LoginStatus;
  loginError: string;
  connectionAttempt: number;
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
  serverUrl: "",
  localMode: startInLocalMode,
  isStarted: startInLocalMode,
  loginOpen: !startInLocalMode,
  loginStatus: startInLocalMode ? "connected" : "idle",
  loginError: "",
  connectionAttempt: 0,
  enableBloom: false,
  bloomStrength: 0.6,
  bloomRadius: 0.4,
  bloomThreshold: 0.85,
});

export const messageEmitter = new MessageEmitter();

export function getDate(timeZoneOffset: number) {
  return new Date(store.data.nowDate + timeZoneOffset);
}