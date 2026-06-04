import { PointOnTrack, SerializableTrack } from "@/lib/tracks";
import { proxy } from "valtio";

export const tracksState = proxy<{
  hoveredTracks: string[];
  selectedTrackIds: string[];
  pointingOnTrack?: PointOnTrack;
  hoveredSwitch: string;
}>({
  hoveredTracks: [],
  selectedTrackIds: [],
  hoveredSwitch: "",
});

export const offsetTrackState = proxy<{
  isOffsetting: boolean;
  offsetDistance: string;
  vehicleOffsetConstant: string;
  transitionLength1: string;
  transitionLength2: string;
  curveRadius: string;
  previewTracks: SerializableTrack[];
}>({
  isOffsetting: false,
  offsetDistance: "3.5",
  vehicleOffsetConstant: "0.5",
  transitionLength1: "20",
  transitionLength2: "20",
  curveRadius: "200",
  previewTracks: [],
});
