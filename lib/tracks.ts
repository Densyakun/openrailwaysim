import { Position } from '@turf/helpers';
import * as THREE from 'three'
import { IdentifiedRecord } from './game';

export type Track = {
  centerCoordinate: Position;
  position: THREE.Vector3;
  rotationY: number;
  length: number;
};

export type SerializableTrack = IdentifiedRecord & {
  centerCoordinate: Position;
  position: THREE.Vector3Tuple;
  rotationY: number;
  length: number;
};
