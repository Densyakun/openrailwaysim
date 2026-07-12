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
  previewTracks: SerializableTrack[];
}>({
  isOffsetting: false,
  offsetDistance: "3.6",
  vehicleOffsetConstant: "24000",
  previewTracks: [],
});
