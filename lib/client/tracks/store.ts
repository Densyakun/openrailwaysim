import { PointOnTrack } from "@/lib/tracks";
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
