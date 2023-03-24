import * as THREE from 'three';
import { proxy } from 'valtio';
import { IdentifiedRecord } from './saveData';
import { ProjectedLineAndLength } from './gis';
import { getPositionFromLength, getSegment, Segment } from "./projectedLine";

export type Axle = {
  pointOnTrack: ProjectedLineAndLength;
  z: number;
};

export type PositionAndRotation = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

export type OnSegment = {
  positionAndRotation?: PositionAndRotation;
  segment?: Segment;
};

export type Bogie = {
  axles: (Axle & OnSegment)[];
  positionAndRotation: PositionAndRotation;
};

export function createBogie({ projectedLine, length }: ProjectedLineAndLength, axlesZ: number[]): Bogie {
  return axlesToBogie(bogieToAxles(axlesZ.map(z => ({
    pointOnTrack: { projectedLine: projectedLine, length: length + z },
    z,
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
  const lastAxlePosition = new THREE.Vector3();

  for (let index = 0; index < axles.length; index++) {
    const axle = axles[index];

    const { pointOnTrack: { projectedLine } } = axle;
    if (projectedLine.points.length < 2) {
      firstAxle++;
      continue;
    }

    const { pointOnTrack: { length } } = axle;
    const segment = getSegment(projectedLine.points, length);

    const position = getPositionFromLength(segment, length);

    const axle_: Axle & OnSegment = {
      ...axle,
      positionAndRotation: {
        position,
        rotation: new THREE.Euler()
      },
      segment,
    };

    bogiePosition.add(position);
    axlesCount++;
    lastAxlePosition.copy(axle_.positionAndRotation!.position);

    axles[index] = axle_;
  };

  return {
    axles,
    positionAndRotation: {
      position: bogiePosition.divideScalar(axlesCount),
      rotation: new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        lastAxlePosition.sub((axles[firstAxle] as Axle & (OnSegment | null)).positionAndRotation!.position).normalize()
      ))
    },
  };
}

export function axlesToBogie(bogie: Bogie): Bogie {
  bogie.axles.forEach(axle => {
    // axles to bogie
    axle.positionAndRotation = {
      position: new THREE.Vector3(0, 0, axle.z)
        .applyEuler(bogie.positionAndRotation.rotation)
        .add(bogie.positionAndRotation.position),
      rotation: bogie.positionAndRotation.rotation,
    };

    // axle.pointOnTrack to track
    const { point, nextPoint, distance, lengthFromStartingPointToNextPoint } = axle.segment || getSegment(axle.pointOnTrack.projectedLine.points, axle.pointOnTrack.length);
    axle.pointOnTrack.length = lengthFromStartingPointToNextPoint
      + axle.positionAndRotation.position.clone().sub(point)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), nextPoint.clone().sub(point).normalize()).invert())
        .x
      - distance;
    axle.segment = undefined;
  });

  return bogie;
}
