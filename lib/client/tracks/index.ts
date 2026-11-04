import { store } from "@/lib/game";
import { Track } from "@/lib/tracks";
import * as THREE from "three";
import { tracksState } from "./store";

export function getSelectedTracks() {
  let tracks: Track[] = [];

  tracksState.selectedTrackIds
    .forEach(trackId => {
      tracks.push(store.data.tracks[trackId]);
    });

  return tracks;
}


/** レールモデルを配置する曲線分割の許容矢高（m） */
export const railModelSagitta = 0.1;

export function getNumberOfCurvePoints(length: number, radius: number) {
  const absRadius = Math.abs(radius);
  if (absRadius < 1e-6) return 2;

  const segmentLength = Math.sqrt(8 * railModelSagitta * absRadius);
  return Math.max(2, Math.ceil(length / segmentLength));
}

export function getRotationFromTwoPoints(point: THREE.Vector3, nextPoint: THREE.Vector3, tilt: number) {
  const euler = new THREE.Euler(0, 0, 0, 'XZY').setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      nextPoint.clone().sub(point).normalize()
    ), 'YXZ'
  );
  euler.z = -tilt;
  return euler;
}
