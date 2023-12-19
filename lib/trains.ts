import * as THREE from "three";
import { proxy } from "valtio";
import { ProjectedLineAndLength, getRelativePosition, eulerToCoordinate } from './gis';
import { getPositionFromLength, getSegment, Segment } from "./projectedLine";
import { IdentifiedRecord } from './saveData';

export type Axle = {
  pointOnTrack: ProjectedLineAndLength;
  z: number;
  segment?: Segment;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  diameter: number;
  rotationX: number;
  hasMotor: boolean;
};

export type CarBody = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  pointOnTrack: ProjectedLineAndLength;
  weight: number; // ton
  masterControllers: OneHandleMasterController[];
}

// 台車。CarBodyの一種
export type Bogie = CarBody & {
  axles: Axle[];
};

// BogieとotherBodyを接続するジョイント
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

// ジョイントで繋いだ複数のCarBody
export type Train = {
  bogies: Bogie[];
  otherBodies: CarBody[]; // 台車を除くCarBody
  bodySupporterJoints: BodySupporterJoint[];
  otherJoints: Joint[]; // CarBody同士を接続するジョイント。連結器や、マレー式機関車の関節、複式ボギーの台車以外の接続に使う
  fromJointIndexes: number[];
  toJointIndexes: number[];
  globalPosition: THREE.Euler;
  speed: number; // m/s
  weight: number; // ton
  motorCars: number;
};

export const state = proxy<{
  trains: (IdentifiedRecord & Train)[];
  hoveredTrainIndex: number;
  hoveredBodyIndex: number;
  activeTrainIndex: number;
  activeBobyIndex: number;
  uiOneHandleMasterControllerConfigs: UIOneHandleMasterControllerConfig[];
}>({
  trains: [],
  hoveredTrainIndex: -1,
  hoveredBodyIndex: -1,
  activeTrainIndex: -1,
  activeBobyIndex: -1,
  uiOneHandleMasterControllerConfigs: [],
});

export function moveTrain({ bogies, otherBodies }: Train, vector: THREE.Vector3) {
  bogies.forEach(bogie => {
    bogie.axles.forEach(axle => axle.position.add(vector));

    bogie.position.add(vector);
  });

  otherBodies.forEach(body => body.position.add(vector));
}

export function moveGlobalPositionOfTrain(train: Train, newPosition: THREE.Euler) {
  const relativePosition = getRelativePosition(
    eulerToCoordinate(newPosition),
    train.globalPosition,
    undefined,
    0
  );

  moveTrain(train, relativePosition);

  train.globalPosition = newPosition;
}

export function updateSegmentCacheToAxle(axle: Axle) {
  return axle.segment = getSegment(axle.pointOnTrack.projectedLine.points, axle.pointOnTrack.length);
}

export function getSegmentCacheFromAxle(axle: Axle) {
  return axle.segment || updateSegmentCacheToAxle(axle);
}

export function getAxlePosition(train: Train, axle: Axle) {
  const { pointOnTrack: { length } } = axle;

  const axleRelativePosition = getPositionFromLength(getSegmentCacheFromAxle(axle), length);

  const globalTrackRelativePosition = getRelativePosition(
    axle.pointOnTrack.projectedLine.centerCoordinate,
    train.globalPosition,
    undefined,
    0
  );

  return globalTrackRelativePosition.add(axleRelativePosition);
}

export function bogieToAxles(train: Train, bogie: Bogie) {
  const axlesCenterPosition = new THREE.Vector3();
  const firstAxlePosition = new THREE.Vector3();
  const lastAxlePosition = new THREE.Vector3();
  const up = new THREE.Vector3();

  for (let index = 0; index < bogie.axles.length; index++) {
    axlesCenterPosition.add(
      lastAxlePosition.copy(
        getAxlePosition(train, bogie.axles[index])
      )
    );

    const { point, nextPoint } = getSegmentCacheFromAxle(bogie.axles[index]);
    const forward = nextPoint.clone().sub(point).normalize();
    const angleY = Math.atan2(forward.x, forward.z);
    const aVector = forward.clone().applyEuler(new THREE.Euler(0, -angleY));
    const angleX = Math.atan2(aVector.y, aVector.z);
    up.add(new THREE.Vector3(0, 1).applyEuler(new THREE.Euler(
      -angleX,
      angleY,
      0,
      'YXZ'
    )));

    if (index === 0)
      firstAxlePosition.copy(lastAxlePosition);
  };

  bogie.position = axlesCenterPosition.divideScalar(bogie.axles.length);

  let forward: THREE.Vector3;
  if (2 <= bogie.axles.length) {
    forward = firstAxlePosition.sub(lastAxlePosition).normalize();
  } else {
    const { point, nextPoint } = getSegmentCacheFromAxle(bogie.axles[0]);
    forward = nextPoint.clone().sub(point).normalize();
  }

  const angleY = Math.atan2(forward.x, forward.z);
  const aVector = forward.clone().applyEuler(new THREE.Euler(0, -angleY));
  const angleX = Math.atan2(aVector.y, aVector.z);
  up.divideScalar(bogie.axles.length);
  const bVector = up.applyEuler(new THREE.Euler(
    angleX,
    -angleY
  ));
  bogie.rotation.set(
    -angleX,
    angleY,
    Math.atan2(-bVector.x, bVector.y),
    'YXZ'
  );
}

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
      train.globalPosition,
      undefined,
      0
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

export function calcJointsToRotateBody(train: Train) {
  train.bogies.forEach((_, fromBogieIndex) => {
    let fromJointZ = 0
    let toJointZ = 0
    let fromJointIndex = -1
    let toJointIndex = -1

    train.bodySupporterJoints.forEach((joint, jointIndex) => {
      if (fromBogieIndex === joint.bogieIndex) {
        if (fromJointIndex === -1 || joint.bogiePosition.z < fromJointZ) {
          fromJointZ = joint.bogiePosition.z
          fromJointIndex = jointIndex
        }
        if (toJointIndex === -1 || toJointZ < joint.bogiePosition.z) {
          toJointZ = joint.bogiePosition.z
          toJointIndex = jointIndex
        }
      }
    })

    train.fromJointIndexes[fromBogieIndex] = fromJointIndex
    train.toJointIndexes[fromBogieIndex] = toJointIndex
  })
  train.otherBodies.forEach((_, fromOtherBodyIndex) => {
    let fromJointZ = 0
    let toJointZ = 0
    let fromJointIndex = -1
    let toJointIndex = -1

    train.bodySupporterJoints.forEach((joint, jointIndex) => {
      if (fromOtherBodyIndex === joint.otherBodyIndex) {
        if (fromJointIndex === -1 || joint.otherBodyPosition.z < fromJointZ) {
          fromJointZ = joint.otherBodyPosition.z
          fromJointIndex = jointIndex
        }
        if (toJointIndex === -1 || toJointZ < joint.otherBodyPosition.z) {
          toJointZ = joint.otherBodyPosition.z
          toJointIndex = jointIndex
        }
      }
    })
    // otherJointsはボールジョイントのため、otherBodyの向きは、otherBodyに合わせないが、
    // 連結器のような、BogieとジョイントされていないotherBodyは、ジョイントされたotherBodyに合わせる。
    const fromBodyIndex = train.bogies.length + fromOtherBodyIndex
    if (fromJointIndex === -1 || toJointIndex === -1) {
      train.otherJoints.forEach((joint, otherJointIndex) => {
        if (fromBodyIndex === joint.bodyIndexA) {
          if (fromJointIndex === -1 || joint.positionA.z < fromJointZ && train.bodySupporterJoints.length <= fromJointIndex) {
            fromJointZ = joint.positionA.z
            fromJointIndex = train.bodySupporterJoints.length + otherJointIndex
          }
          if (toJointIndex === -1 || toJointZ < joint.positionA.z && train.bodySupporterJoints.length <= fromJointIndex) {
            toJointZ = joint.positionA.z
            toJointIndex = train.bodySupporterJoints.length + otherJointIndex
          }
        } else if (fromBodyIndex === joint.bodyIndexB) {
          if (fromJointIndex === -1 || joint.positionB.z < fromJointZ && train.bodySupporterJoints.length <= fromJointIndex) {
            fromJointZ = joint.positionB.z
            fromJointIndex = train.bodySupporterJoints.length + otherJointIndex
          }
          if (toJointIndex === -1 || toJointZ < joint.positionB.z && train.bodySupporterJoints.length <= fromJointIndex) {
            toJointZ = joint.positionB.z
            toJointIndex = train.bodySupporterJoints.length + otherJointIndex
          }
        }
      })
    }

    train.fromJointIndexes[fromBodyIndex] = fromJointIndex
    train.toJointIndexes[fromBodyIndex] = toJointIndex
  })
}

export function placeOtherBodies(train: Train) {
  train.otherBodies.forEach(otherBody => {
    const segment = getSegment(otherBody.pointOnTrack.projectedLine.points, otherBody.pointOnTrack.length);
    const axleRelativePosition = getPositionFromLength(segment, otherBody.pointOnTrack.length);

    const globalTrackRelativePosition = getRelativePosition(
      otherBody.pointOnTrack.projectedLine.centerCoordinate,
      train.globalPosition,
      undefined,
      0
    );

    otherBody.position.copy(globalTrackRelativePosition.add(axleRelativePosition));

    const { point, nextPoint } = segment;
    const forward = nextPoint.clone().sub(point).normalize();
    const angleY = Math.atan2(forward.x, forward.z);
    const aVector = forward.clone().applyEuler(new THREE.Euler(0, -angleY));
    const angleX = Math.atan2(aVector.y, aVector.z);
    const up = new THREE.Vector3(0, 1).applyEuler(new THREE.Euler(
      -angleX,
      angleY,
      0,
      'YXZ'
    ));
    const bVector = up.applyEuler(new THREE.Euler(
      angleX,
      -angleY
    ));
    otherBody.rotation.set(
      -angleX,
      angleY,
      Math.atan2(-bVector.x, bVector.y),
      'YXZ'
    );
  });
}

export function syncOtherBodies(train: Train) {
  // 位置を設定する
  train.otherBodies.forEach((fromBody, fromOtherBodyIndex) => {
    const position = new THREE.Vector3();
    let jointCount = 0;

    const fromBodyIndex = train.bogies.length + fromOtherBodyIndex;
    train.bodySupporterJoints.forEach(joint => {
      if (fromOtherBodyIndex === joint.otherBodyIndex) {
        position.add(getFromPosition(
          fromBody,
          train.bogies[joint.bogieIndex],
          joint.otherBodyPosition,
          joint.bogiePosition
        ));

        jointCount++;
      }
    });
    train.otherJoints.forEach(joint => {
      if (fromBodyIndex === joint.bodyIndexA) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexB);

        position.add(getFromPosition(
          fromBody,
          toBody,
          joint.positionA,
          joint.positionB
        ));

        jointCount++;
      } else if (fromBodyIndex === joint.bodyIndexB) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexA);

        position.add(getFromPosition(
          fromBody,
          toBody,
          joint.positionB,
          joint.positionA
        ));

        jointCount++;
      }
    });

    if (jointCount)
      fromBody.position.copy(position.divideScalar(jointCount));
  });

  // 回転を設定する
  train.otherBodies.forEach((fromBody, fromOtherBodyIndex) => {
    let fromJointEuler: THREE.Euler | undefined;
    let fromJointPosition: THREE.Vector3;
    let toJointEuler: THREE.Euler;
    let toJointPosition: THREE.Vector3;

    const fromBodyIndex = train.bogies.length + fromOtherBodyIndex;
    train.bodySupporterJoints.forEach((joint, jointIndex) => {
      if (fromOtherBodyIndex === joint.otherBodyIndex) {
        if (train.fromJointIndexes[fromBodyIndex] === jointIndex) {
          fromJointEuler = train.bogies[joint.bogieIndex].rotation;
          fromJointPosition = train.bogies[joint.bogieIndex].position.clone()
            .add(joint.bogiePosition.clone().applyEuler(train.bogies[joint.bogieIndex].rotation));
        }
        if (train.toJointIndexes[fromBodyIndex] === jointIndex) {
          toJointEuler = train.bogies[joint.bogieIndex].rotation;
          toJointPosition = train.bogies[joint.bogieIndex].position.clone()
            .add(joint.bogiePosition.clone().applyEuler(train.bogies[joint.bogieIndex].rotation));
        }
      }
    });
    train.otherJoints.forEach((joint, otherJointIndex) => {
      const jointIndex = train.bodySupporterJoints.length + otherJointIndex;
      if (fromBodyIndex === joint.bodyIndexA) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexB);

        if (train.fromJointIndexes[fromBodyIndex] === jointIndex) {
          fromJointEuler = toBody.rotation;
          fromJointPosition = toBody.position.clone()
            .add(joint.positionB.clone().applyEuler(toBody.rotation));
        }
        if (train.toJointIndexes[fromBodyIndex] === jointIndex) {
          toJointEuler = toBody.rotation;
          toJointPosition = toBody.position.clone()
            .add(joint.positionB.clone().applyEuler(toBody.rotation));
        }
      } else if (fromBodyIndex === joint.bodyIndexB) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexA);

        if (train.fromJointIndexes[fromBodyIndex] === jointIndex) {
          fromJointEuler = toBody.rotation;
          fromJointPosition = toBody.position.clone()
            .add(joint.positionA.clone().applyEuler(toBody.rotation));
        }
        if (train.toJointIndexes[fromBodyIndex] === jointIndex) {
          toJointEuler = toBody.rotation;
          toJointPosition = toBody.position.clone()
            .add(joint.positionA.clone().applyEuler(toBody.rotation));
        }
      }
    });

    if (fromJointEuler) {
      if (fromJointPosition!.equals(toJointPosition!))
        fromBody.rotation.copy(fromJointEuler!);
      else {
        const up = new THREE.Vector3(0, 1).applyEuler(fromJointEuler!)
          .add(new THREE.Vector3(0, 1).applyEuler(toJointEuler!))
          .normalize();
        const forward = toJointPosition!.clone()
          .sub(fromJointPosition!)
          .normalize();

        const angleY = Math.atan2(forward.x, forward.z);
        const aVector = forward.clone().applyEuler(new THREE.Euler(0, -angleY));
        const angleX = Math.atan2(aVector.y, aVector.z);
        const bVector = up.applyEuler(new THREE.Euler(
          angleX,
          -angleY
        ));
        fromBody.rotation.set(
          -angleX,
          angleY,
          Math.atan2(-bVector.x, bVector.y),
          'YXZ'
        );
      }
    }
  });
}

export function placeTrain(train: Train) {
  // 連結器の向きを反転させないため
  placeOtherBodies(train);

  train.bogies.forEach(bogie => bogieToAxles(train, bogie));

  syncOtherBodies(train);

  train.bogies.forEach(fromBogie => axlesToBogie(train, fromBogie));
}

export function rollAxles(train: Train, distance: number) {
  let oldBogiesInvertedQuaternion = getBogiesQuaternion(train).invert();

  const center = new THREE.Vector3();
  const newCenter = new THREE.Vector3();
  train.bogies.forEach(bogie => {
    center.add(bogie.position);

    // 輪軸を転がす
    bogie.axles.forEach(axle => {
      axle.pointOnTrack.length += distance;
      updateSegmentCacheToAxle(axle);
      axle.rotationX += distance * axle.diameter;
    });

    // ボギーを輪軸に合わせる
    bogieToAxles(train, bogie);

    newCenter.add(bogie.position);
  });
  center.divideScalar(train.bogies.length);
  newCenter.divideScalar(train.bogies.length);

  const newBogiesQuaternion = getBogiesQuaternion(train);

  // otherBodiesをボギーに合わせる
  train.otherBodies.forEach(fromBody => {
    if (fromBody.position)
      fromBody.position.sub(center).applyQuaternion(oldBogiesInvertedQuaternion)
        .applyQuaternion(newBogiesQuaternion)
        .add(newCenter);

    fromBody.rotation.copy(new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromEuler(fromBody.rotation)
        .multiply(oldBogiesInvertedQuaternion)
        .multiply(newBogiesQuaternion)
    ));
  });

  // ボギーを含むCarBodyの位置と向きをジョイントに合わせる
  syncOtherBodies(train);

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

        jointCount++;
      } else if (fromBogieIndex === joint.bodyIndexB) {
        const toBody = getBodyFromBodyIndex(train, joint.bodyIndexA);

        position.add(getFromPosition(
          fromBogie,
          toBody,
          joint.positionB,
          joint.positionA
        ));

        jointCount++;
      }
    });

    if (jointCount)
      fromBogie.position.copy(position.divideScalar(jointCount));

    // 輪軸をボギーに合わせる
    axlesToBogie(train, fromBogie);
  });

  train.bogies.forEach(bogie => bogieToAxles(train, bogie));
}

export type UIOneHandleMasterControllerConfig = {
  steps: number[];
  marks: {
    value: number,
    label: string,
  }[];
  maxValue: number;
  nValue: number;
  stepRangeList: [number, number][];
};

export type OneHandleMasterController = {
  value: number;
  uiOptionsIndex: number;
};

export function getOneHandleMasterControllerOutput(masterController: OneHandleMasterController) {
  // TODO Call different functions depending on the vehicle
  return getOneHandleMasterControllerSimpleOutput(masterController);
}

export function getOneHandleMasterControllerSimpleOutput(masterController: OneHandleMasterController) {
  const config = state.uiOneHandleMasterControllerConfigs[masterController.uiOptionsIndex];

  return [Math.max(0, 1 - masterController.value / config.nValue), Math.max(0, (masterController.value - config.nValue) / (config.maxValue - config.nValue))];
}

export function getTractiveForcePerMotorCars(speed: number/*, voltage: number, fieldCoil: number*/) {
  // TODO Call different functions depending on the vehicle
  return getTractiveForcePerMotorCarsJNR103Series(speed)
}

export function getTractiveForcePerMotorCarsJNR103Series(speed: number/*, voltage: number, fieldCoil: number*/) {
  // TODO 性能曲線（力行ノッチ曲線）を追加する
  return 4500
}