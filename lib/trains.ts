import * as THREE from "three";
import { store } from "./game";
import { PointOnTrack, TransitionCurve, getDistance, getLength, getPosition, getRotation, runPointOnTrack } from "./tracks";
import { assignSchedulesToTrains, DEFAULT_STOP_RANGE, DiagramTrackRoute, getRouteIndex, ROUTE_NOT_VIA, TIME_IS_NOT_SET, twelveHoursMilliseconds } from "./diagram";

// Resistances

export const startingResistance = 30; // 出発抵抗 (N/t)
export const runningResistanceA = 1.273; // 走行抵抗の定数A。輪軸あたりの車軸と軸受の摩擦に依存する値
export const runningResistanceB = 0.001; // 走行抵抗の定数B。輪軸あたりの車輪とレールの摩擦に依存する値
export const runningResistanceC = 0.0001381; // 走行抵抗の定数C。空気抵抗に依存する値

export type Axle = {
  pointOnTrack: PointOnTrack;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  rotationX: number;
  rotationIsReversed: boolean;
};

export type SerializableAxle = {
  pointOnTrack: PointOnTrack;
  position: THREE.Vector3Tuple;
  rotation: [number, number, number, THREE.EulerOrder];
  rotationIsReversed: boolean;
};

export type CarBody = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  weight: number; // ton
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

export type SerializableBodySupporterJoint = {
  otherBodyIndex: number;
  otherBodyPosition: THREE.Vector3Tuple;
  bogieIndex: number;
  bogiePosition: THREE.Vector3Tuple;
};

/**
 * CarBody同士を接続するジョイント。連結器や、マレー式機関車の関節、複式ボギーの台車以外の接続に使う
 */
export type Joint = {
  bodyIndexA: number;
  positionA: THREE.Vector3;
  bodyIndexB: number;
  positionB: THREE.Vector3;
};

export type SerializableJoint = {
  bodyIndexA: number;
  positionA: THREE.Vector3Tuple;
  bodyIndexB: number;
  positionB: THREE.Vector3Tuple;
};

export type BogieFormat = {
  offset: number;
  axles: {
    z: number;
    diameter: number;
    hasMotor: boolean;
  }[];
  weight: number;
};

export type TrainFormat = {
  bogies: BogieFormat[];
  otherBodyOffsets: number[];
  otherBodyWeights: number[];
  cabFormats: (CabFormatType | null)[];
  bodySupporterJoints: BodySupporterJoint[];
  otherJoints: Joint[];
};

export type SerializableTrainFormat = {
  bogies: BogieFormat[];
  otherBodyOffsets: number[];
  otherBodyWeights: number[];
  cabFormats: (CabFormatType | null)[];
  bodySupporterJoints: SerializableBodySupporterJoint[];
  otherJoints: SerializableJoint[];
};

// ジョイントで繋いだ複数のCarBody
export type Train = {
  trainFormatId: string;
  bogies: Bogie[];
  otherBodies: CarBody[]; // 台車を除くCarBody
  cabStates: (CabStateType | null)[];
  fromJointIndexes: number[];
  toJointIndexes: number[];
  speed: number; // m/s
  weight: number; // ton
  motors: number;
  currentDiagramId: string;
  currentDiagramCurveIndex: number;
  currentDiagramSectionIndex: number;
  currentRouteIndex: number;
  isStopping: boolean;
};

export type SerializableTrain = {
  trainFormatId: string;
  cabStates: (CabStateType | null)[];
  speed: number;
  currentDiagramId: string;
  currentDiagramCurveIndex: number;
  currentDiagramSectionIndex: number;
  currentRouteIndex: number;
  isStopping: boolean;
  pointOnTrack: PointOnTrack;
  directionIsReversed: boolean;
};

/**
 * 列車を設置して、設置した列車と判定結果を返す。ワールドに設置する列車には後からtrainFormatIdを設定する必要がある
 * @param trainFormat 列車形式
 * @param pointOnTrack 列車を設置する位置
 * @param directionIsReversed 軌道に対して向きを反転させるかどうか
 * @returns 設置した列車と判定結果。輪軸やOtherBodyが軌道の外に設置される場合、isDeadEndがtrueとなる。不正な列車形式データを使用する場合、trainはundefinedを返す
 */
export function placeTrain(
  trainFormat: TrainFormat,
  pointOnTrack: PointOnTrack,
  directionIsReversed: boolean,
): {
  train?: Train;
  isDeadEnd: boolean;
} {
  if (!trainFormat.bogies.length) return { isDeadEnd: false };
  const syncData = store.data;

  let isDeadEnd_ = false;

  const bogies: Bogie[] = [];
  for (let bogieIndex = 0; bogieIndex < trainFormat.bogies.length; bogieIndex++) {
    const axleFormats = trainFormat.bogies[bogieIndex].axles;

    const axles: Axle[] = [];
    for (const axleFormat of axleFormats) {
      const { newPointOnTrack, isDeadEnd, newDirectionIsReversed } = runPointOnTrack(
        pointOnTrack,
        directionIsReversed,
        trainFormat.bogies[bogieIndex].offset + axleFormat.z,
      );

      if (isDeadEnd) isDeadEnd_ = isDeadEnd;

      axles.push({
        pointOnTrack: newPointOnTrack,
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        rotationX: 0,
        rotationIsReversed: newDirectionIsReversed,
      });
    }

    bogies.push({
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      weight: trainFormat.bogies[bogieIndex].weight,
      axles,
    });
  }

  const otherBodies: CarBody[] = [];
  const cabStates: (CabStateType | null)[] = [];
  for (let otherBodyIndex = 0; otherBodyIndex < trainFormat.otherBodyOffsets.length; otherBodyIndex++) {
    const cabFormat = trainFormat.cabFormats[otherBodyIndex];
    if (cabFormat && !syncData.uiOneHandleMasterControllerConfigs[cabFormat.oneHandleMasterControllerUIConfigId])
      return { isDeadEnd: false };

    cabStates.push(cabFormat && {
      reverser: 0,
      masterControllerValue: syncData.uiOneHandleMasterControllerConfigs[cabFormat.oneHandleMasterControllerUIConfigId].maxValue,
    });

    const { newPointOnTrack, isDeadEnd, newDirectionIsReversed } = runPointOnTrack(
      pointOnTrack,
      directionIsReversed,
      trainFormat.otherBodyOffsets[otherBodyIndex],
    );

    if (isDeadEnd) isDeadEnd_ = isDeadEnd;

    const track = syncData.tracks[newPointOnTrack.trackId];
    otherBodies.push({
      position: getPosition(track, newPointOnTrack.length),
      rotation: getAxleRotation(newPointOnTrack, newDirectionIsReversed),
      weight: trainFormat.otherBodyWeights[otherBodyIndex],
    });
  }

  const bodySupporterJoints_: BodySupporterJoint[] = [];
  trainFormat.bodySupporterJoints.forEach(bodySupporterJoint => {
    if (bodySupporterJoint.otherBodyIndex !== -1
      && bodySupporterJoint.bogieIndex !== -1)
      bodySupporterJoints_.push({
        otherBodyIndex: bodySupporterJoint.otherBodyIndex,
        otherBodyPosition: new THREE.Vector3(
          -bodySupporterJoint.otherBodyPosition.x * (directionIsReversed ? -1 : 1),
          bodySupporterJoint.otherBodyPosition.y,
          bodySupporterJoint.otherBodyPosition.z * (directionIsReversed ? -1 : 1),
        ),
        bogieIndex: bodySupporterJoint.bogieIndex,
        bogiePosition: new THREE.Vector3(
          -bodySupporterJoint.bogiePosition.x * (directionIsReversed ? -1 : 1),
          bodySupporterJoint.bogiePosition.y,
          bodySupporterJoint.bogiePosition.z * (directionIsReversed ? -1 : 1),
        ),
      });
  });

  const otherJoints_: Joint[] = [];
  trainFormat.otherJoints.forEach(joint => {
    if (joint.bodyIndexA !== -1
      && joint.bodyIndexB !== -1)
      otherJoints_.push({
        bodyIndexA: joint.bodyIndexA,
        positionA: new THREE.Vector3(
          -joint.positionA.x * (directionIsReversed ? -1 : 1),
          joint.positionA.y,
          joint.positionA.z * (directionIsReversed ? -1 : 1),
        ),
        bodyIndexB: joint.bodyIndexB,
        positionB: new THREE.Vector3(
          -joint.positionB.x * (directionIsReversed ? -1 : 1),
          joint.positionB.y,
          joint.positionB.z * (directionIsReversed ? -1 : 1),
        ),
      });
  });

  let trainWeight = trainFormat.otherBodyWeights.reduce((previous, weight) => previous + weight,
    trainFormat.bogies.reduce((previous, bogie) => previous + bogie.weight, 0)
  );
  if (trainWeight <= 0) trainWeight = 30;

  const train: Train = {
    trainFormatId: "",
    bogies,
    otherBodies,
    cabStates,
    fromJointIndexes: [],
    toJointIndexes: [],
    speed: 0,
    weight: trainWeight,
    motors: 0,
    currentDiagramId: "",
    currentDiagramCurveIndex: -1,
    currentDiagramSectionIndex: 0,
    currentRouteIndex: 0,
    isStopping: true,
  };

  train.motors = trainFormat.bogies.reduce((prev, bogie) => prev +
    bogie.axles.reduce((prev, axle) => prev +
      (axle.hasMotor ? 1 : 0),
      0),
    0);

  calcJointsToRotateBody(train, trainFormat);

  // TODO 編集中の列車も同期処理を行うため、ここでの仮置きしたOtherBodiesの同期は不要？
  /*train.bogies.forEach(bogie => bogieToAxles(syncData, bogie));

  syncOtherBodies(syncData, train);

  train.bogies.forEach(fromBogie => axlesToBogie(syncData, fromBogie));*/

  return {
    train,
    isDeadEnd: isDeadEnd_
  };
}

export function getPointOnTrackByTrain(train: Train) {
  const syncData = store.data;
  const trainFormat = syncData.trainFormats[train.trainFormatId];

  return runPointOnTrack(
    train.bogies[0].axles[0].pointOnTrack,
    !train.bogies[0].axles[0].rotationIsReversed,
    trainFormat.bogies[0].offset + trainFormat.bogies[0].axles[0].z
  );
}

export function moveTrain({ bogies, otherBodies }: Train, vector: THREE.Vector3) {
  bogies.forEach(bogie => {
    bogie.axles.forEach(axle => axle.position.add(vector));

    bogie.position.add(vector);
  });

  otherBodies.forEach(body => body.position.add(vector));
}

export function getAxlePosition(axle: Axle) {
  const syncData = store.data;
  const { pointOnTrack: { length } } = axle;

  const track = syncData.tracks[axle.pointOnTrack.trackId];
  return getPosition(track, length);
}

export function getAxleRotation(pointOnTrack: PointOnTrack, rotationIsReversed: boolean) {
  const syncData = store.data;
  const track = syncData.tracks[pointOnTrack.trackId];
  const rotation = getRotation(track, pointOnTrack.length);

  if (rotationIsReversed) {
    rotation.x = -rotation.x;
    rotation.y += Math.PI;
    rotation.z = -rotation.z;
  }

  return rotation;
}

export function bogieToAxles(bogie: Bogie) {
  const axlesCenterPosition = new THREE.Vector3();
  const firstAxlePosition = new THREE.Vector3();
  const lastAxlePosition = new THREE.Vector3();
  let rotationX = 0;
  const rotationY = new THREE.Vector2();
  let rotationZ = 0;

  for (let index = 0; index < bogie.axles.length; index++) {
    axlesCenterPosition.add(
      lastAxlePosition.copy(
        getAxlePosition(bogie.axles[index])
      )
    );

    const axleRotation = getAxleRotation(bogie.axles[index].pointOnTrack, bogie.axles[index].rotationIsReversed);
    rotationX += axleRotation.x;
    rotationY.add(new THREE.Vector2(Math.cos(axleRotation.y), -Math.sin(axleRotation.y)));
    rotationZ += axleRotation.z;

    if (index === 0)
      firstAxlePosition.copy(lastAxlePosition);
  };

  bogie.position = axlesCenterPosition.divideScalar(bogie.axles.length);

  rotationX /= bogie.axles.length;
  rotationZ /= bogie.axles.length;
  bogie.rotation.set(
    rotationX,
    Math.atan2(-rotationY.y, rotationY.x),
    rotationZ,
    'YXZ'
  );
}

export function updatePointOnTrackToTrack(pointOnTrack: PointOnTrack, position: THREE.Vector3) {
  const syncData = store.data;
  const track = syncData.tracks[pointOnTrack.trackId];

  // 緩和曲線で輪軸が正しく停止しないバグがあるため、コメントアウト
  // 計算量が多いため緩和曲線では省く
  if ((track as TransitionCurve).endPosition !== undefined) return;

  // axle.pointOnTrack to track
  pointOnTrack.length = getLength(position, track);
}

export function axlesToBogie(bogie: Bogie, bogieFormat: BogieFormat) {
  bogie.axles.forEach((axle, index) => {
    // axles to bogie
    axle.position.copy(new THREE.Vector3(0, 0, bogieFormat.axles[index].z)
      .applyEuler(bogie.rotation)
      .add(bogie.position));
    axle.rotation.copy(bogie.rotation);

    // axle.pointOnTrack to track
    updatePointOnTrackToTrack(
      axle.pointOnTrack,
      axle.position,
    )
  });
}

export function getBogiesQuaternion({ bogies }: Train) {
  return 2 <= bogies.length
    ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1), bogies[bogies.length - 1].position.clone().sub(bogies[0].position).normalize())
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

export function calcJointsToRotateBody(train: Train, trainFormat: TrainFormat) {
  train.bogies.forEach((_, fromBogieIndex) => {
    let fromJointZ = 0
    let toJointZ = 0
    let fromJointIndex = -1
    let toJointIndex = -1

    trainFormat.bodySupporterJoints.forEach((joint, jointIndex) => {
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

    trainFormat.bodySupporterJoints.forEach((joint, jointIndex) => {
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
      trainFormat.otherJoints.forEach((joint, otherJointIndex) => {
        if (fromBodyIndex === joint.bodyIndexA) {
          if (fromJointIndex === -1 || joint.positionA.z < fromJointZ && trainFormat.bodySupporterJoints.length <= fromJointIndex) {
            fromJointZ = joint.positionA.z
            fromJointIndex = trainFormat.bodySupporterJoints.length + otherJointIndex
          }
          if (toJointIndex === -1 || toJointZ < joint.positionA.z && trainFormat.bodySupporterJoints.length <= fromJointIndex) {
            toJointZ = joint.positionA.z
            toJointIndex = trainFormat.bodySupporterJoints.length + otherJointIndex
          }
        } else if (fromBodyIndex === joint.bodyIndexB) {
          if (fromJointIndex === -1 || joint.positionB.z < fromJointZ && trainFormat.bodySupporterJoints.length <= fromJointIndex) {
            fromJointZ = joint.positionB.z
            fromJointIndex = trainFormat.bodySupporterJoints.length + otherJointIndex
          }
          if (toJointIndex === -1 || toJointZ < joint.positionB.z && trainFormat.bodySupporterJoints.length <= fromJointIndex) {
            toJointZ = joint.positionB.z
            toJointIndex = trainFormat.bodySupporterJoints.length + otherJointIndex
          }
        }
      })
    }

    train.fromJointIndexes[fromBodyIndex] = fromJointIndex
    train.toJointIndexes[fromBodyIndex] = toJointIndex
  })
}

export function syncOtherBodies(train: Train, trainFormat: TrainFormat) {
  // 位置を設定する
  train.otherBodies.forEach((fromBody, fromOtherBodyIndex) => {
    const position = new THREE.Vector3();
    let jointCount = 0;

    const fromBodyIndex = train.bogies.length + fromOtherBodyIndex;
    trainFormat.bodySupporterJoints.forEach(joint => {
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
    trainFormat.otherJoints.forEach(joint => {
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
    trainFormat.bodySupporterJoints.forEach((joint, jointIndex) => {
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
    trainFormat.otherJoints.forEach((joint, otherJointIndex) => {
      const jointIndex = trainFormat.bodySupporterJoints.length + otherJointIndex;
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
        fromBody.rotation.set(
          (fromJointEuler.x + toJointEuler!.x) / 2,
          (fromJointEuler.y + toJointEuler!.y) / 2,
          (fromJointEuler.z + toJointEuler!.z) / 2,
          'YXZ'
        );
      }
    }
  });
}

export function updateTrainOnTime(train: Train, delta: number) {
  const syncData = store.data;
  const trainFormat = syncData.trainFormats[train.trainFormatId];

  // 自動でマスコンと主制御器（Control System）を接続する
  let accel = 0;
  let brake = 1;
  train.cabStates.forEach((cabState, index) => {
    if (!cabState) return;
    const cabFormat = trainFormat.cabFormats[index];
    if (!cabFormat) return;

    const [accel1, brake1] = getOneHandleMasterControllerOutput(cabFormat, cabState);

    accel += accel1;
    brake = Math.min(brake, brake1)
  });
  accel = 0 < accel ? Math.min(1, accel) : Math.max(-1, accel);

  const speedKMH = train.speed * 3.6

  // Accel
  //const fieldCoil = 1 // TODO 界磁 (0-1)
  const tractiveForce = getTractiveForcePerMotors(train.speed/*, fieldCoil*/) // 牽引力 (引張力, kg)
  const a = 30.9

  //const acceleration = 3.0 / 3.6 // 3.0 km/h/s
  let acceleration = accel * tractiveForce * train.motors / train.weight / a / 3.6 // m/s/s

  // Braking and resistance
  let deceleration = brake * 4.5 / 3.6 // 4.5 km/h/s

  // 出発抵抗
  const startingResistance_ = startingResistance * (3 - Math.min(3, Math.max(0, speedKMH))) / 1000

  const g = 9.80665 // 重力加速度 (m/s/s)

  // 走行抵抗
  const resistances = Math.max(
    startingResistance_,
    g * (runningResistanceA + runningResistanceB * speedKMH + runningResistanceC * speedKMH * speedKMH)
  )

  // TODO 勾配抵抗を輪軸にかかる重量から計算する
  // TODO grade
  // TODO train.bogies[0].axles[0].rotationIsReversed
  /*const track = syncData.tracks[train.bogies[0].axles[0].pointOnTrack.trackId]
  const { point, nextPoint } = getSegment(projectedLine.points, train.bogies[0].axles[0].pointOnTrack.length + train.centroidZ)
  const distance = point.distanceTo(nextPoint)
  acceleration += train.weight * g * Math.sin(Math.atan2(point.y - nextPoint.y, distance)) / train.weight*/

  deceleration += resistances / train.weight

  train.speed += acceleration * delta

  train.speed =
    0 <= train.speed
      ? Math.max(0, train.speed - deceleration * delta)
      : Math.min(0, train.speed + deceleration * delta)

  // Run a trains
  rollAxles(train, trainFormat, train.speed * delta)

  // 列車の停車、通過を判定する
  if (train.currentDiagramId) {
    const diagram = syncData.diagrams[train.currentDiagramId];
    const trackRoute = diagram.sections[train.currentDiagramSectionIndex].routes[train.currentRouteIndex];
    const diagramCurve = diagram.diagramCurves[train.currentDiagramCurveIndex];

    if (train.isStopping) {
      const nowTime = syncData.nowDate % (twelveHoursMilliseconds * 2);

      // 停車時刻を求めるため、前のルートを求める
      let prevSectionIndex = -1;
      for (let i = train.currentDiagramCurveIndex - 1; 0 <= i; i--)
        if (diagramCurve.passTime[i] !== ROUTE_NOT_VIA) {
          prevSectionIndex = i;
          break;
        }

      // 停車時刻と発車時刻を過ぎているか判定する
      if (
        (prevSectionIndex === -1 || diagramCurve.stopTime[prevSectionIndex] === TIME_IS_NOT_SET || (diagramCurve.stopTime[prevSectionIndex] - twelveHoursMilliseconds - nowTime) % (twelveHoursMilliseconds * 2) <= -twelveHoursMilliseconds)
        && (diagramCurve.passTime[train.currentDiagramSectionIndex] === TIME_IS_NOT_SET || (diagramCurve.passTime[train.currentDiagramSectionIndex] - twelveHoursMilliseconds - nowTime) % (twelveHoursMilliseconds * 2) <= -twelveHoursMilliseconds)
      )
        train.isStopping = false;
    } else {
      let isPassed = false;
      if (diagramCurve.isPasses[train.currentDiagramSectionIndex]) {
        // trackのEnd側にprevTrackが接続されているかどうかを求める
        const trackId = train.bogies[0].axles[0].pointOnTrack.trackId;
        const prevTrackId = trackRoute.trackIds.length < 2 ? "" : trackRoute.trackIds[trackRoute.trackIds.length - 2];
        const track = syncData.tracks[trackId];

        let isConnectedFromTrackEnd = false;
        if (track.connectedFromEndIsTrack) {
          if (track.idOfTrackOrSwitchConnectedFromEnd === prevTrackId)
            isConnectedFromTrackEnd = true;
        } else {
          const railroadSwitch = syncData.switches[track.idOfTrackOrSwitchConnectedFromEnd];
          if (railroadSwitch.connectedTrackIds.includes(prevTrackId))
            isConnectedFromTrackEnd = true;
        }

        const distance = getDistanceToNextStop(train, trackRoute);
        if (distance !== undefined && (isConnectedFromTrackEnd ? 0 < distance : distance < 0))
          isPassed = true;
      } else if (!train.speed) {
        const distance = getDistanceToNextStop(train, trackRoute);
        if (distance !== undefined && -DEFAULT_STOP_RANGE <= distance && distance <= DEFAULT_STOP_RANGE) {
          isPassed = true;
          train.isStopping = true;
        }
      }

      if (isPassed)
        while (true) {
          train.currentDiagramSectionIndex++;

          // 運行が終了したときに列車ダイヤの割り当てを解除する
          if (diagram.sections.length <= train.currentDiagramSectionIndex) {
            train.currentDiagramId = "";
            train.currentDiagramCurveIndex = -1;
            train.currentDiagramSectionIndex = 0;
            train.currentRouteIndex = 0;

            // サーバー側で列車ダイヤの自動割り当てを実行する
            if (typeof window === "undefined")
              assignSchedulesToTrains(syncData);
            break;
          }

          if (diagramCurve.passTime[train.currentDiagramSectionIndex] !== ROUTE_NOT_VIA) {
            train.currentRouteIndex = getRouteIndex(diagram.sections, diagramCurve, train.currentDiagramSectionIndex, train.bogies[0].axles[0].pointOnTrack.trackId);
            break;
          }
        }
    }
  }
}

export function rollAxles(train: Train, trainFormat: TrainFormat, distance: number) {
  const syncData = store.data;
  let oldBogiesInvertedQuaternion = getBogiesQuaternion(train).invert();

  const center = new THREE.Vector3();
  const newCenter = new THREE.Vector3();
  train.bogies.forEach((bogie, bogieIndex) => {
    center.add(bogie.position);

    // 輪軸を転がす
    bogie.axles.forEach((axle, axleIndex) => {
      const { newPointOnTrack, newDirectionIsReversed, isDeadEnd } = runPointOnTrack(axle.pointOnTrack, axle.rotationIsReversed, distance);

      axle.pointOnTrack = newPointOnTrack;
      axle.rotationIsReversed = newDirectionIsReversed;
      if (isDeadEnd) train.speed = 0;

      axle.rotationX += distance * trainFormat.bogies[bogieIndex].axles[axleIndex].diameter;
    });

    // ボギーを輪軸に合わせる
    bogieToAxles(bogie);

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
  syncOtherBodies(train, trainFormat);

  train.bogies.forEach((fromBogie, fromBogieIndex) => {
    const position = new THREE.Vector3();
    let jointCount = 0;

    trainFormat.bodySupporterJoints.forEach(joint => {
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
    trainFormat.otherJoints.forEach(joint => {
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
    axlesToBogie(fromBogie, syncData.trainFormats[train.trainFormatId].bogies[fromBogieIndex]);
  });

  train.bogies.forEach(bogie => bogieToAxles(bogie));
}

export type CabFormatType = {
  directionIsReversed: boolean;
  oneHandleMasterControllerUIConfigId: string;
}

export type CabStateType = {
  reverser: number;
  masterControllerValue: number;
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

export function getOneHandleMasterControllerOutput(cabFormat: CabFormatType, cabState: CabStateType) {
  // TODO Call different functions depending on the vehicle
  return getOneHandleMasterControllerSimpleOutput(cabFormat, cabState);
}

export function getOneHandleMasterControllerSimpleOutput(cabFormat: CabFormatType, cabState: CabStateType) {
  const syncData = store.data;
  const config = syncData.uiOneHandleMasterControllerConfigs[cabFormat.oneHandleMasterControllerUIConfigId];
  if (!config) return [0, 0];

  return [
    (cabFormat.directionIsReversed ? -1 : 1) * cabState.reverser * Math.max(0, 1 - cabState.masterControllerValue / config.nValue),
    Math.max(0, (cabState.masterControllerValue - config.nValue) / (config.maxValue - config.nValue))
  ];
}

export function getTractiveForcePerMotors(speed: number/*, fieldCoil: number*/) {
  // TODO Call different functions depending on the vehicle
  return getTractiveForcePerMotorsJNR103Series(speed)
}

export function getTractiveForcePerMotorsJNR103Series(speed: number/*, fieldCoil: number*/) {
  // TODO 性能曲線（力行ノッチ曲線）を追加する
  return 1125
}

export function getDistanceToNextStop(train: Train, trackRoute: DiagramTrackRoute) {
  let distance: number | undefined;
  const pointOnTrack = train.bogies[0].axles[0].pointOnTrack;
  for (let i = 0; i < trackRoute.trackIds.length; i++) {
    if (trackRoute.trackIds[i] === pointOnTrack.trackId) {
      distance = getDistance(trackRoute.trackIds, trackRoute.stopOffset, pointOnTrack.length, i);
      break;
    }
  }

  return distance;
}
