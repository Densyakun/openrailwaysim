import * as THREE from "three";
import { proxy } from "valtio";
import { ProjectedLineAndLength, getRelativePosition, GlobalPositionEuler, eulerToCoordinate } from './gis';
import { getPositionFromLength, getSegment, Segment } from "./projectedLine";
import { IdentifiedRecord } from './saveData';

export type Axle = {
  pointOnTrack: ProjectedLineAndLength;
  z: number;
  segment?: Segment;
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

export type CarBody = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

export type Bogie = CarBody & {
  axles: Axle[];
};

export type BodySupporterJoint = {
  otherBodyIndex: number;
  otherBodyPosition: THREE.Vector3;
  bogieIndex: number;
  bogiePosition: THREE.Vector3;
};

export type Joint = {
  bodyIndexA: number;
  positionA: THREE.Vector3;
  bodyIndexB: number;
  positionB: THREE.Vector3;
};

export type Train = {
  bogies: Bogie[];
  otherBodies: CarBody[];
  bodySupporterJoints: BodySupporterJoint[];
  otherJoints: Joint[];
  position: GlobalPositionEuler; // TODO elevationを使っていない
};

export const state = proxy<{
  trains: (IdentifiedRecord & Train)[];
}>({
  trains: [],
});

export function moveTrain({ bogies, otherBodies }: Train, vector: THREE.Vector3) {
  bogies.forEach(bogie => {
    bogie.axles.forEach(axle => axle.position.add(vector));

    bogie.position.add(vector);
  });

  otherBodies.forEach(body => body.position.add(vector));
}

export function moveGlobalPositionOfTrain(train: Train, newPosition: GlobalPositionEuler) {
  const relativePosition = getRelativePosition(
    eulerToCoordinate(newPosition.euler),
    train.position.euler,
    undefined,
    newPosition.elevation - train.position.elevation,
  );

  moveTrain(train, relativePosition);

  train.position = newPosition;
}

export function updateSegmentCacheToAxle(axle: Axle) {
  return axle.segment = getSegment(axle.pointOnTrack.projectedLine.points, axle.pointOnTrack.length);
}

export function getSegmentCacheFromAxle(axle: Axle) {
  return axle.segment || updateSegmentCacheToAxle(axle);
}

export function getAxlePosition(train: Train, axle: Axle) {
  const { pointOnTrack: { length } } = axle;
  updateSegmentCacheToAxle(axle); // TODO 輪軸を移動するときに設定する

  const axleRelativePosition = getPositionFromLength(getSegmentCacheFromAxle(axle), length);

  const globalTrackRelativePosition = getRelativePosition(
    axle.pointOnTrack.projectedLine.centerCoordinate,
    train.position.euler,
    undefined,
    train.position.elevation,
  );

  return globalTrackRelativePosition.add(axleRelativePosition);
}

export function bogieToAxles(train: Train, bogie: Bogie) {
  const axlesCenterPosition = new THREE.Vector3();
  const firstAxlePosition = new THREE.Vector3();
  const lastAxlePosition = new THREE.Vector3();

  for (let index = 0; index < bogie.axles.length; index++) {
    axlesCenterPosition.add(
      lastAxlePosition.copy(
        getAxlePosition(train, bogie.axles[index])
      )
    );

    if (index === 0)
      firstAxlePosition.copy(lastAxlePosition);
  };

  bogie.position = axlesCenterPosition.divideScalar(bogie.axles.length);
  if (2 <= bogie.axles.length)
    bogie.rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      lastAxlePosition.sub(firstAxlePosition).normalize()
    ));
  else {
    const { point, nextPoint } = getSegmentCacheFromAxle(bogie.axles[0]);
    bogie.rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      nextPoint.clone().sub(point).normalize()
    ));
  }
}

/*export function bogiesToAxles(train: Train) {
  train.bogies.forEach(bogie => bogieToAxles(train, bogie));

  return train;
}*/

export function axlesToBogie(train: Train, bogie: Bogie) {
  bogie.axles.forEach(axle => {
    // axles to bogie
    axle.position.copy(new THREE.Vector3(0, 0, axle.z)
      .applyEuler(bogie.rotation)
      .add(bogie.position));
    axle.rotation.copy(bogie.rotation);

    // axle.pointOnTrack to track
    const { point, nextPoint, distance, lengthFromStartingPointToNextPoint } = axle.segment || (axle.segment = getSegment(axle.pointOnTrack.projectedLine.points, axle.pointOnTrack.length));

    const globalTrackRelativePosition = getRelativePosition(
      axle.pointOnTrack.projectedLine.centerCoordinate,
      train.position.euler,
      undefined,
      train.position.elevation,
    );

    axle.pointOnTrack.length = lengthFromStartingPointToNextPoint
      + axle.position.clone().sub(globalTrackRelativePosition).sub(point)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), nextPoint.clone().sub(point).normalize()).invert())
        .x
      - distance;
  });
}

export function axlesToBogies(train: Train) {
  train.bogies.forEach(bogie => axlesToBogie(train, bogie));

  return train;
}

/*export function getCenter({ bogies, otherBodies }: Train) {
  const center = new THREE.Vector3();

  bogies.forEach(bogie => center.add(bogie.position));
  otherBodies.forEach(body => center.add(body.position));

  return center.divideScalar(bogies.length + otherBodies.length);
}*/

/*export function getBogiesCenter({ bogies }: Train) {
  const center = new THREE.Vector3();

  bogies.forEach(bogie => center.add(bogie.position));

  return center.divideScalar(bogies.length);
}*/

export function getBogiesQuaternion({ bogies }: Train) {
  return 2 <= bogies.length
    ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), bogies[bogies.length - 1].position.clone().sub(bogies[0].position).normalize()) // TODO 向きが正しいか確認する
    : new THREE.Quaternion().setFromEuler(bogies[0].rotation);
}

export function getFromPosition(fromBody: CarBody, toBody: CarBody, fromPosition: THREE.Vector3, toPosition: THREE.Vector3) {
  return toBody.position.clone()
    .add(toPosition.clone().applyEuler(toBody.rotation))
    .sub(fromPosition.clone().applyEuler(fromBody.rotation));
}

export function bodyIndexIsBogie(train: Train, bodyIndex: number) {
  return bodyIndex < train.bogies.length;
}

export function getBodyFromBodyIndex(train: Train, bodyIndex: number) {
  return bodyIndexIsBogie(train, bodyIndex)
    ? train.bogies[bodyIndex]
    : train.otherBodies[bodyIndex - train.bogies.length];
}

/*export function bodySupporterChainReaction(train: Train, causeBodyIndex: number, callback: (nextBodyIndex: number) => void, causeBodyIndexes: number[] = []) {
  causeBodyIndexes.forEach(bodyIndex => {
    if (bodyIndex === causeBodyIndex)
      return;
  });
  causeBodyIndexes.push(causeBodyIndex);

  const causeOtherBodyIndex = causeBodyIndex + train.bogies.length;
  train.bodySupporterJoints.forEach(jointB => {
    if (causeOtherBodyIndex === jointB.otherBodyIndex)
      bodySupporterChainReaction(train, jointB.bogieIndex, callback, causeBodyIndexes);
    else if (causeBodyIndex === jointB.bogieIndex)
      bodySupporterChainReaction(train, jointB.otherBodyIndex, callback, causeBodyIndexes);
  });
}*/

export function rotateBody(fromBody: CarBody, toBody: CarBody, fromPosition: THREE.Vector3, toPosition: THREE.Vector3) {
  const fromVector = fromPosition.clone().applyEuler(fromBody.rotation).normalize();
  const toVector = toBody.position.clone()
    .add(toPosition.clone().applyEuler(toBody.rotation))
    .sub(fromBody.position).normalize();
  fromBody.rotation.copy(new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromEuler(fromBody.rotation)
      //.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), fromVector).invert())
      //.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), toVector))
      .multiply(new THREE.Quaternion().setFromUnitVectors(fromVector, toVector))
  ));
}

export function rollAxles(train: Train, distance: number) {
  let bogiesQuaternion = getBogiesQuaternion(train);

  const center = new THREE.Vector3();
  const newCenter = new THREE.Vector3();
  train.bogies.forEach(bogie => {
    center.add(bogie.position);

    // 輪軸を転がす
    bogie.axles.forEach(axle => axle.pointOnTrack.length += distance);

    // ボギーを輪軸に合わせる
    bogieToAxles(train, bogie);

    newCenter.add(bogie.position);
  });
  center.divideScalar(train.bogies.length);
  newCenter.divideScalar(train.bogies.length);

  const newBogiesQuaternion = getBogiesQuaternion(train);

  // otherBodiesをボギーに合わせる
  train.otherBodies.forEach(fromBody => {
    fromBody.position.sub(center).applyQuaternion(bogiesQuaternion.invert())
      .applyQuaternion(newBogiesQuaternion)
      .add(newCenter);
  });

  // A otherBodiesをボギーに合わせる
  /*train.otherBodies.forEach((fromBody, fromOtherBodyIndex) => {
    const position = new THREE.Vector3();
    let jointCount = 0;

    train.bodySupporterJoints.forEach(joint => {
      if (fromOtherBodyIndex === joint.otherBodyIndex) {
        const toBody = getBodyFromBodyIndex(train, joint.bogieIndex);

        position.add(getFromPosition(
          fromBody,
          toBody,
          joint.otherBodyPosition,
          joint.bogiePosition
        ));

        const fromVector = joint.otherBodyPosition.clone().applyEuler(fromBody.rotation);
        const toVector = toBody.position.clone()
          .add(joint.bogiePosition.clone().applyEuler(toBody.rotation))
          .sub(fromBody.position);
        fromBody.rotation.copy(new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion().setFromEuler(fromBody.rotation)
            //.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), fromVector).invert())
            //.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), toVector.normalize()))
            .multiply(new THREE.Quaternion().setFromUnitVectors(fromVector, toVector.normalize()))
        ));

        jointCount++;
      }
    });

    fromBody.position.copy(position.divideScalar(jointCount));
  });*/

  // ボギーを含むCarBodyの位置と向きをジョイントに合わせる
  train.otherBodies.forEach((fromBody, fromOtherBodyIndex) => {
    const position = new THREE.Vector3();
    let jointCount = 0;

    train.bodySupporterJoints.forEach(joint => {
      if (fromOtherBodyIndex === joint.otherBodyIndex) {
        position.add(getFromPosition(
          fromBody,
          train.bogies[joint.bogieIndex],
          joint.otherBodyPosition,
          joint.bogiePosition
        ));

        rotateBody(fromBody, train.bogies[joint.bogieIndex], joint.otherBodyPosition, joint.bogiePosition);

        jointCount++;
      }
    });
    train.otherJoints.forEach(joint => {
      if (fromOtherBodyIndex === joint.bodyIndexA) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexB);

        position.add(getFromPosition(
          fromBody,
          toBody,
          joint.positionA,
          joint.positionB
        ));

        rotateBody(fromBody, toBody, joint.positionA, joint.positionB);

        jointCount++;
      } else if (fromOtherBodyIndex === joint.bodyIndexB) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexA);

        position.add(getFromPosition(
          fromBody,
          toBody,
          joint.positionB,
          joint.positionA
        ));

        rotateBody(fromBody, toBody, joint.positionB, joint.positionA);

        jointCount++;
      }
    });

    if (jointCount)
      fromBody.position.copy(position.divideScalar(jointCount));
  });
  train.bogies.forEach((fromBogie, fromBogieIndex) => {
    const position = new THREE.Vector3();
    let jointCount = 0;

    train.bodySupporterJoints.forEach(joint => {
      if (fromBogieIndex === joint.bogieIndex) {
        position.add(getFromPosition(
          fromBogie,
          train.otherBodies[joint.otherBodyIndex],
          joint.bogiePosition,
          joint.otherBodyPosition
        ));

        rotateBody(fromBogie, train.otherBodies[joint.otherBodyIndex], joint.bogiePosition, joint.otherBodyPosition);

        jointCount++;
      }
    });
    train.otherJoints.forEach(joint => {
      if (fromBogieIndex === joint.bodyIndexA) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexB);

        position.add(getFromPosition(
          fromBogie,
          toBody,
          joint.positionA,
          joint.positionB
        ));

        rotateBody(fromBogie, toBody, joint.positionA, joint.positionB);

        jointCount++;
      } else if (fromBogieIndex === joint.bodyIndexB) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexA);

        position.add(getFromPosition(
          fromBogie,
          toBody,
          joint.positionB,
          joint.positionA
        ));

        rotateBody(fromBogie, toBody, joint.positionB, joint.positionA);

        jointCount++;
      }
    });

    if (jointCount)
      fromBogie.position.copy(position.divideScalar(jointCount));

    // 輪軸をボギーに合わせる
    axlesToBogie(train, fromBogie);
  });

  // A ボギーとジョイントしていないCarBody（=連結器のような中間のotherBody）の位置を、それぞれのジョイントから求める
  /*train.otherJoints.forEach(joint => {
  });*/

  // A 他のジョイントを、すでに計算しているジョイントをまとめて同期する
  /*train.otherJoints.forEach(jointA => {
    const bodyA = getBodyFromBodyIndex(train, jointA.bodyIndexA);
    const bodyB = getBodyFromBodyIndex(train, jointA.bodyIndexB);

    const newPositionA = getFromPosition(bodyA, bodyB, jointA.positionA, jointA.positionB);
    const move = newPositionA.sub(bodyA.position);

    bodyA.position.copy(newPositionA);

    bodySupporterChainReaction(
      train,
      jointA.bodyIndexA,
      nextBodyIndex => getBodyFromBodyIndex(train, nextBodyIndex).position.add(move)
    );
  });*/

  // A ボギーとotherBodiesを元のTrainの中心位置に戻す
  /*let newCenter = getBogiesCenter(train);
  let newBogiesQuaternion = getBogiesQuaternion(train);

  train.bogies.forEach(bogie => {
  });
  train.otherBodies.forEach(body => {
  });*/

  // A 輪軸をボギーに合わせる
  //axlesToBogies(train);
}
