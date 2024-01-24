import { Position } from '@turf/helpers';
import * as THREE from 'three'
import { IdentifiedRecord } from './game';
import { proxy } from 'valtio';

export type Track = {
  centerCoordinate: Position;
  position: THREE.Vector3;
  rotationY: number;
  length: number;
  radius: number;
  idOfTrackOrSwitchConnectedFromStart: string;
  idOfTrackOrSwitchConnectedFromEnd: string;
  connectedFromStartIsTrack: boolean;
  connectedFromEndIsTrack: boolean;
  connectedFromStartIsToEnd: boolean;
  connectedFromEndIsToEnd: boolean;
};

export type SerializableTrack = IdentifiedRecord & {
  centerCoordinate: Position;
  position: THREE.Vector3Tuple;
  rotationY: number;
  length: number;
  radius: number;
  idOfTrackOrSwitchConnectedFromStart: string;
  idOfTrackOrSwitchConnectedFromEnd: string;
  connectedFromStartIsTrack: boolean;
  connectedFromEndIsTrack: boolean;
  connectedFromStartIsToEnd: boolean;
  connectedFromEndIsToEnd: boolean;
};

export type PointOnTrack = {
  trackId: string;
  length: number;
}

export const state = proxy<{
  hoveredTracks: string[];
  selectedTracks: string[];
  pointingOnTrack?: PointOnTrack;
}>({
  hoveredTracks: [],
  selectedTracks: [],
});

export function getPosition(position: THREE.Vector3, rotationY: number, length: number, radius: number) {
  if (length === 0)
    return position.clone();

  if (radius === 0)
    return position.clone().add(new THREE.Vector3(1).applyEuler(new THREE.Euler(0, rotationY)).multiplyScalar(length));
  else
    return position.clone()
      .add(new THREE.Vector3(0, 0, radius).applyEuler(new THREE.Euler(0, rotationY)))
      .add(new THREE.Vector3(0, 0, -radius).applyEuler(new THREE.Euler(0, length / -radius + rotationY)));
}

export function getRotation(position: THREE.Vector3, rotationY: number, length: number, radius: number) {
  if (radius === 0)
    return new THREE.Euler(0, rotationY);
  else
    return new THREE.Euler(0, length / -radius + rotationY);
}

export function getLength(point: THREE.Vector3, track: Track) {
  if (track.radius === 0) {
    return point.clone().sub(track.position)
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), getPosition(track.position, track.rotationY, track.length, 0).clone().sub(track.position).normalize()).invert())
      .x;
  } else {
    const position_ = point.clone().sub(track.position)
      .sub(new THREE.Vector3(0, 0, track.radius).applyEuler(new THREE.Euler(0, track.rotationY)))
      .applyEuler(new THREE.Euler(0, -track.rotationY));

    const eulerY = position_.x === 0 && position_.z === 0 ? 0 :
      Math.atan2(0 < track.radius ? position_.z : -position_.z, position_.x) + Math.PI / 2;

    // TODO 角度が範囲外の場合、近い方に合わせる

    return eulerY * Math.abs(track.radius);
  }
}

export type Switch = {
  connectedTrackIds: string[];
  isConnectedToEnd: boolean[];
  currentConnected: number;
};

export type SerializableSwitch = IdentifiedRecord & Switch;
