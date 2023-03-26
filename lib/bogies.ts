import * as THREE from 'three';
import { proxy } from 'valtio';
import { Position } from '@turf/helpers';
import { IdentifiedRecord } from './saveData';
import { ProjectedLineAndLength, getRelativePosition, coordinateToEuler } from './gis';
import { getPositionFromLength, getSegment, Segment } from "./projectedLine";

export type PositionAndRotation = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

export type Axle = {
  pointOnTrack: ProjectedLineAndLength;
  z: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  segment?: Segment;
};

export type Bogie = {
  axles: Axle[];
  centerCoordinate: Position;
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

export function createBogie({ projectedLine, length }: ProjectedLineAndLength, axlesZ: number[]): Bogie {
  return axlesToBogie(bogieToAxles(axlesZ.map(z => ({
    pointOnTrack: { projectedLine: projectedLine, length: length + z },
    z,
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
  }))));
}

export const state = proxy<{
  bogies: (IdentifiedRecord & Bogie)[];
}>({
  bogies: [],
});

export function bogieToAxles(axles: Axle[]): Bogie {
  const bogiePosition = new THREE.Vector3();
  let axlesCount = 0;
  let firstAxle = 0;
  const firstAxlePosition = new THREE.Vector3();
  const lastAxlePosition = new THREE.Vector3();

  for (let index = 0; index < axles.length; index++) {
    const axle = axles[index];

    const { pointOnTrack: { projectedLine } } = axle;
    if (projectedLine.points.length < 2) {
      firstAxle++;
      continue;
    }

    const { pointOnTrack: { length } } = axle;
    axle.segment = getSegment(projectedLine.points, length);

    axle.position = getPositionFromLength(axle.segment, length);

    const relativePosition = getRelativePosition(
      axle.pointOnTrack.projectedLine.centerCoordinate,
      coordinateToEuler(axles[firstAxle].pointOnTrack.projectedLine.centerCoordinate),
      undefined,
      axle.position.y
    )
      .add(axle.position);
    bogiePosition.add(lastAxlePosition.copy(relativePosition));

    axlesCount++;
  };

  return {
    axles,
    centerCoordinate: axles[firstAxle].pointOnTrack.projectedLine.centerCoordinate,
    position: bogiePosition.divideScalar(axlesCount),
    rotation: new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      lastAxlePosition.sub(firstAxlePosition).normalize()
    )),
  };
}

export function axlesToBogie(bogie: Bogie): Bogie {
  bogie.axles.forEach(axle => {
    // axles to bogie
    axle.position.copy(new THREE.Vector3(0, 0, axle.z)
      .applyEuler(bogie.rotation)
      .add(bogie.position));
    axle.rotation.copy(bogie.rotation);

    // axle.pointOnTrack to track
    const { point, nextPoint, distance, lengthFromStartingPointToNextPoint } = axle.segment || getSegment(axle.pointOnTrack.projectedLine.points, axle.pointOnTrack.length);
    axle.pointOnTrack.length = lengthFromStartingPointToNextPoint
      + axle.position.clone().sub(point)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), nextPoint.clone().sub(point).normalize()).invert())
        .x
      - distance;
  });

  return bogie;
}
