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

export const SAVE_URL_CANDIDATES_STORAGE_KEY = "ors.saveUrlCandidates";

export type SaveUrlCandidate = {
  name: string;
  url: string;
};

export function loadSaveUrlCandidates(): SaveUrlCandidate[] {
  try {
    const raw = localStorage.getItem(SAVE_URL_CANDIDATES_STORAGE_KEY);
    if (!raw) return [];

    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    return value.filter((candidate): candidate is SaveUrlCandidate =>
      candidate
      && typeof candidate.name === "string"
      && typeof candidate.url === "string"
    );
  } catch {
    return [];
  }
}

export function saveSaveUrlCandidates(candidates: SaveUrlCandidate[]) {
  try {
    localStorage.setItem(SAVE_URL_CANDIDATES_STORAGE_KEY, JSON.stringify(candidates));
  } catch {
    // localStorage が使えない場合は状態のみ更新する
  }
}

export function addSaveUrlCandidate(name: string, url: string) {
  const normalizedName = name.trim() || url;
  const candidates = clientState.saveUrlCandidates.filter(candidate => candidate.url !== url);
  candidates.push({ name: normalizedName, url });
  clientState.saveUrlCandidates = candidates;
  saveSaveUrlCandidates(candidates);
}

export function removeSaveUrlCandidate(url: string) {
  const candidates = clientState.saveUrlCandidates.filter(candidate => candidate.url !== url);
  clientState.saveUrlCandidates = candidates;
  saveSaveUrlCandidates(candidates);
}

export function getSaveUrlCandidateName(url: string) {
  try {
    const parsed = new URL(url);
    const filename = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
    return filename.replace(/\.json$/i, "") || parsed.hostname || url;
  } catch {
    return url;
  }
}

const startInLocalMode = isLocalMode();

export const clientState = proxy<{
  readyState: 0 | 1 | 2 | 3;
  isSynced: boolean;
  cameraFar: number;
  visibleFeatureCollections: string[];
  showSaveSuccess: boolean;
  saveNotificationMessage: string;
  username: string;
  connectionPassword: string;
  isAuthenticated: boolean;
  passwordRequired: boolean;
  isAdmin: boolean;
  adminPasswordRequired: boolean;
  saves: string[];
  currentSave: string;
  currentSaveUrl: string;
  saveUrlStatus: "idle" | "loading" | "success" | "error";
  saveUrlMessage: string;
  saveUrlCandidates: SaveUrlCandidate[];
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
  saveNotificationMessage: "",
  username: "",
  connectionPassword: "",
  isAuthenticated: false,
  passwordRequired: false,
  isAdmin: false,
  adminPasswordRequired: false,
  saves: [],
  currentSave: "",
  currentSaveUrl: "",
  saveUrlStatus: "idle",
  saveUrlMessage: "",
  saveUrlCandidates: loadSaveUrlCandidates(),
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