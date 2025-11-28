import { store } from "@/lib/game";
import { Track } from "@/lib/tracks";
import * as THREE from "three";
import { tracksState } from "./store";

export function getSelectedTracks() {
  let tracks: Track[] = [];

  tracksState.selectedTrackIds
    .forEach(trackId => {
      tracks.push(store.syncData.tracks[trackId]);
    });

  return tracks;
}

export let railModelFactor = 60; //曲線に設置するレールのモデルの個数の係数

export function getNumberOfCurvePoints(length: number, radius: number) {
  return Math.max(2, Math.ceil(length * railModelFactor / Math.abs(radius)));
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
