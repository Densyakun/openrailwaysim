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
};

export type SerializableTrack = IdentifiedRecord & {
  centerCoordinate: Position;
  position: THREE.Vector3Tuple;
  rotationY: number;
  length: number;
  radius: number;
};

export const state = proxy<{
  hoveredTracks: string[];
  selectedTracks: string[];
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
