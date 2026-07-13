import { proxy } from "valtio";
import { SerializableTrack } from "../tracks";

export type SwitchPlacementState = {
  isPlacing: boolean;
  mainTrackId: string;
  mainTrackLength: number;
  switchNumber: number;
  isJapanese: boolean;
  isDivergeLeft: boolean;
  divergingLength: number;
  previewTracks: SerializableTrack[];
};

export const switchPlacementState = proxy<SwitchPlacementState>({
  isPlacing: false,
  mainTrackId: "",
  mainTrackLength: 0,
  switchNumber: 10,
  isJapanese: true,
  isDivergeLeft: false,
  divergingLength: 50,
  previewTracks: [],
});
