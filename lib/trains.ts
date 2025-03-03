import * as THREE from "three";
import { getRelativePosition, eulerToCoordinate, coordinateToEuler, getMeridianAngle } from './gis';
import { SaveDataType, SerializableEuler } from "./game";
import { PointOnTrack, TransitionCurve, getDistance, getLength, getPosition, getRotation, runPointOnTrack } from "./tracks";
import { assignSchedulesToTrains, DEFAULT_STOP_RANGE, DiagramTrackRoute, getRouteIndex, ROUTE_NOT_VIA, TIME_IS_NOT_SET, twelveHoursMilliseconds } from "./diagram";

// Resistances

export const startingResistance = 30; // 出発抵抗 (N/t)
export const runningResistanceA = 1.273; // 走行抵抗の定数A。輪軸あたりの車軸と軸受の摩擦に依存する値
export const runningResistanceB = 0.001; // 走行抵抗の定数B。輪軸あたりの車輪とレールの摩擦に依存する値
export const runningResistanceC = 0.0001381; // 走行抵抗の定数C。空気抵抗に依存する値

export type Axle = {
  pointOnTrack: PointOnTrack;
  z: number;
  //segment?: Segment;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  diameter: number;
  rotationX: number;
  hasMotor: boolean;
  rotationIsReversed: boolean;
};

export type SerializableAxle = {
  pointOnTrack: PointOnTrack;
  z: number;
  position: THREE.Vector3Tuple;
  rotation: [number, number, number, THREE.EulerOrder];
  diameter: number;
  hasMotor: boolean;
  rotationIsReversed: boolean;
};

export type CarBody = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  pointOnTrack: PointOnTrack;
  weight: number; // ton
}

export type SerializableCarBody = {
  position: THREE.Vector3Tuple;
  rotation: SerializableEuler;
  pointOnTrack: PointOnTrack;
  weight: number;
}

// 台車。CarBodyの一種
export type Bogie = CarBody & {
  axles: Axle[];
};

export type SerializableBogie = SerializableCarBody & {
  axles: SerializableAxle[];
};

export type OtherBody = CarBody & {
  controlStand?: ControlStandType;
};

export type SerializableOtherBody = SerializableCarBody & {
  controlStand?: ControlStandType;
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

// ジョイントで繋いだ複数のCarBody
export type Train = {
  bogies: Bogie[];
  otherBodies: OtherBody[]; // 台車を除くCarBody
  bodySupporterJoints: BodySupporterJoint[];
  otherJoints: Joint[]; // CarBody同士を接続するジョイント。連結器や、マレー式機関車の関節、複式ボギーの台車以外の接続に使う
  fromJointIndexes: number[];
  toJointIndexes: number[];
  globalPosition: THREE.Euler;
  speed: number; // m/s
  weight: number; // ton
  centroidZ: number; // 第一軸から重心に近い軌道上の相対位置
  motors: number;
  currentDiagramId: string;
  currentDiagramCurveIndex: number;
  currentRouteListIndex: number;
  currentRouteIndex: number;
  isStopping: boolean;
};

export type SerializableTrain = {
  bogies: SerializableBogie[];
  otherBodies: SerializableOtherBody[];
  bodySupporterJoints: SerializableBodySupporterJoint[];
  otherJoints: SerializableJoint[];
  speed: number;
  motors: number;
  currentDiagramId: string;
  currentDiagramCurveIndex: number;
  currentRouteListIndex: number;
  currentRouteIndex: number;
  isStopping: boolean;
};

export function getGlobalEulerOfFirstAxle(saveData: SaveDataType, axle: Axle) {
  return coordinateToEuler(saveData.tracks[axle.pointOnTrack.trackId].centerCoordinate || [0, 0])
}

export function createTrain(saveData: SaveDataType, bogies: Bogie[], otherBodies: CarBody[] = [], bodySupporterJoints: BodySupporterJoint[] = [], otherJoints: Joint[] = [], speed = 0, motors?: number): Train {
  let weight_ = 0
  bogies.forEach(bogie => weight_! += bogie.weight)
  otherBodies.forEach(body => weight_! += body.weight)

  if (weight_ === 0)
    weight_ = 30

  // 重心を計算
  // TODO CarBodyなどの重量を含め、列車の重心を計算する
  // TODO 軌道の接続に対応したら、異なるTrackから重心を求める
  let centroidZ = 0
  let axleCount = 0
  bogies.forEach(bogie => {
    bogie.axles.forEach(axle => centroidZ += axle.pointOnTrack.length)
    axleCount += bogie.axles.length
  })
  centroidZ /= axleCount
  centroidZ -= bogies[0].axles[0].pointOnTrack.length

  let motors_ = motors
  if (motors_ === undefined) {
    motors_ = 0
    bogies.forEach(bogie => {
      bogie.axles.forEach(axle => {
        if (axle.hasMotor) motors_!++
      })
    })
  }

  const train: Train = {
    bogies,
    otherBodies,
    bodySupporterJoints,
    otherJoints,
    fromJointIndexes: [],
    toJointIndexes: [],
    globalPosition: getGlobalEulerOfFirstAxle(saveData, bogies[0].axles[0]),
    speed,
    weight: weight_,
    centroidZ,
    motors: motors_,
    currentDiagramId: "",
    currentDiagramCurveIndex: -1,
    currentRouteListIndex: 0,
    currentRouteIndex: 0,
    isStopping: true,
  }

  calcJointsToRotateBody(train)

  placeTrain(saveData, train)

  return train
}

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

export function getAxlePosition(saveData: SaveDataType, train: Train, axle: Axle) {
  const { pointOnTrack: { length } } = axle;

  const track = saveData.tracks[axle.pointOnTrack.trackId];
  const axleRelativePosition = getPosition(track, length);

  const globalTrackRelativePosition = getRelativePosition(
    track.centerCoordinate,
    train.globalPosition,
    undefined,
    0
  );

  return globalTrackRelativePosition.add(axleRelativePosition);
}

export function getAxleRotation(saveData: SaveDataType, train: Train, pointOnTrack: PointOnTrack, rotationIsReversed: boolean) {
  const track = saveData.tracks[pointOnTrack.trackId];
  const axleRelativeRotation = getRotation(track, pointOnTrack.length);

  if (rotationIsReversed) {
    axleRelativeRotation.x = -axleRelativeRotation.x;
    axleRelativeRotation.y += Math.PI;
    axleRelativeRotation.z = -axleRelativeRotation.z;
  }

  // 軌道の進行方向がX軸、列車の進行方向がZ軸になっている
  return new THREE.Euler(
    -axleRelativeRotation.z,
    axleRelativeRotation.y + Math.PI / 2 + getMeridianAngle(track.centerCoordinate, train.globalPosition),
    axleRelativeRotation.x,
    'YXZ'
  );
}

export function bogieToAxles(saveData: SaveDataType, train: Train, bogie: Bogie) {
  const axlesCenterPosition = new THREE.Vector3();
  const firstAxlePosition = new THREE.Vector3();
  const lastAxlePosition = new THREE.Vector3();
  let rotationX = 0;
  const rotationY = new THREE.Vector2();
  let rotationZ = 0;

  for (let index = 0; index < bogie.axles.length; index++) {
    axlesCenterPosition.add(
      lastAxlePosition.copy(
        getAxlePosition(saveData, train, bogie.axles[index])
      )
    );

    const axleRotation = getAxleRotation(saveData, train, bogie.axles[index].pointOnTrack, bogie.axles[index].rotationIsReversed);
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

export function pointOnTrackToTrack(saveData: SaveDataType, pointOnTrack: PointOnTrack, globalPosition: THREE.Euler, position: THREE.Vector3) {
  const track = saveData.tracks[pointOnTrack.trackId];

  // 緩和曲線で輪軸が正しく停止しないバグがあるため、コメントアウト
  // 計算量が多いため緩和曲線では省く
  if ((track as TransitionCurve).endPosition !== undefined) return;

  // axle.pointOnTrack to track
  const globalTrackRelativePosition = getRelativePosition(
    track.centerCoordinate,
    globalPosition,
    undefined,
    0
  );

  pointOnTrack.length = getLength(position.clone().sub(globalTrackRelativePosition), track);
}

export function axlesToBogie(saveData: SaveDataType, train: Train, bogie: Bogie) {
  bogie.axles.forEach(axle => {
    // axles to bogie
    axle.position.copy(new THREE.Vector3(0, 0, axle.z)
      .applyEuler(bogie.rotation)
      .add(bogie.position));
    axle.rotation.copy(bogie.rotation);

    // axle.pointOnTrack to track
    pointOnTrackToTrack(
      saveData,
      axle.pointOnTrack,
      train.globalPosition,
      axle.position,
    )
  });
}

export function axlesToBogies(saveData: SaveDataType, train: Train) {
  train.bogies.forEach(bogie => axlesToBogie(saveData, train, bogie));

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

export function placeOtherBodies(saveData: SaveDataType, train: Train) {
  train.otherBodies.forEach(otherBody => {
    const track = saveData.tracks[otherBody.pointOnTrack.trackId];
    const axleRelativePosition = getPosition(track, otherBody.pointOnTrack.length);

    const globalTrackRelativePosition = getRelativePosition(
      track.centerCoordinate,
      train.globalPosition,
      undefined,
      0
    );

    otherBody.position.copy(globalTrackRelativePosition.add(axleRelativePosition));

    otherBody.rotation.copy(getAxleRotation(saveData, train, otherBody.pointOnTrack, false));
  });
}

export function syncOtherBodies(saveData: SaveDataType, train: Train) {
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

    // Update pointOnTrack of other body
    pointOnTrackToTrack(
      saveData,
      fromBody.pointOnTrack,
      train.globalPosition,
      fromBody.position,
    );
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

export function placeTrain(saveData: SaveDataType, train: Train) {
  // 連結器の向きを反転させないため
  placeOtherBodies(saveData, train);

  train.bogies.forEach(bogie => bogieToAxles(saveData, train, bogie));

  syncOtherBodies(saveData, train);

  train.bogies.forEach(fromBogie => axlesToBogie(saveData, train, fromBogie));
}

export function updateTrainOnTime(saveData: SaveDataType, train: Train, delta: number) {
  // 自動でマスコンと主制御器（Control System）を接続する
  let accel = 0;
  let brake = 1;
  train.otherBodies.forEach(body => {
    if (!body.controlStand) return;

    const [accel1, brake1] = getOneHandleMasterControllerOutput(saveData, body.controlStand);

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

  // 勾配抵抗を計算する。計算を単純化するため、重心に近い地点の勾配から抵抗を計算する
  // TODO grade
  // TODO train.bogies[0].axles[0].rotationIsReversed
  /*const track = saveData.tracks[train.bogies[0].axles[0].pointOnTrack.trackId]
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
  rollAxles(saveData, train, train.speed * delta)

  // 列車の停車、通過を判定する
  if (train.currentDiagramId) {
    const diagram = saveData.diagrams[train.currentDiagramId];
    const routeMap = diagram.routeMap;
    const trackRoute = routeMap[train.currentRouteListIndex][train.currentRouteIndex];
    const diagramCurve = diagram.diagramCurves[train.currentDiagramCurveIndex];

    if (train.isStopping) {
      const nowTime = saveData.nowDate % (twelveHoursMilliseconds * 2);

      // 停車時刻を求めるため、前のルートを求める
      let prevRouteListIndex = -1;
      for (let i = train.currentDiagramCurveIndex - 1; 0 <= i; i--)
        if (diagramCurve.passTime[i] !== ROUTE_NOT_VIA) {
          prevRouteListIndex = i;
          break;
        }

      // 停車時刻と発車時刻を過ぎているか判定する
      if (
        (prevRouteListIndex === -1 || diagramCurve.stopTime[prevRouteListIndex] === TIME_IS_NOT_SET || (diagramCurve.stopTime[prevRouteListIndex] - twelveHoursMilliseconds - nowTime) % (twelveHoursMilliseconds * 2) <= -twelveHoursMilliseconds)
        && (diagramCurve.passTime[train.currentRouteListIndex] === TIME_IS_NOT_SET || (diagramCurve.passTime[train.currentRouteListIndex] - twelveHoursMilliseconds - nowTime) % (twelveHoursMilliseconds * 2) <= -twelveHoursMilliseconds)
      )
        train.isStopping = false;
    } else {
      let isPassed = false;
      if (diagramCurve.isPasses[train.currentRouteListIndex]) {
        // TODO distanceは軌道の向きであるため、通過する方向で判定する
        /*const distance = getDistanceToNextStop(saveData, train, trackRoute);
        if (distance !== undefined && 0 < distance)
          isPassed = true;*/
      } else if (!train.speed) {
        const distance = getDistanceToNextStop(saveData, train, trackRoute);
        if (distance !== undefined && -DEFAULT_STOP_RANGE <= distance && distance <= DEFAULT_STOP_RANGE) {
          isPassed = true;
          train.isStopping = true;
        }
      }

      if (isPassed)
        while (true) {
          train.currentRouteListIndex++;

          // 運行が終了したときに列車ダイヤの割り当てを解除する
          if (routeMap.length <= train.currentRouteListIndex) {
            train.currentDiagramId = "";
            train.currentDiagramCurveIndex = -1;
            train.currentRouteListIndex = 0;
            train.currentRouteIndex = 0;

            // サーバー側で列車ダイヤの自動割り当てを実行する
            if (typeof window === "undefined")
              assignSchedulesToTrains(saveData);
            break;
          }

          if (diagramCurve.passTime[train.currentRouteListIndex] !== ROUTE_NOT_VIA) {
            train.currentRouteIndex = getRouteIndex(routeMap, diagramCurve, train.currentRouteListIndex, train.bogies[0].axles[0].pointOnTrack.trackId);
            break;
          }
        }
    }
  }
}

export function rollAxles(saveData: SaveDataType, train: Train, distance: number) {
  let oldBogiesInvertedQuaternion = getBogiesQuaternion(train).invert();

  const center = new THREE.Vector3();
  const newCenter = new THREE.Vector3();
  train.bogies.forEach(bogie => {
    center.add(bogie.position);

    // 輪軸を転がす
    bogie.axles.forEach(axle => {
      const { newPointOnTrack, newDirectionIsReversed, isDeadEnd } = runPointOnTrack(saveData, axle.pointOnTrack, axle.rotationIsReversed, distance);

      axle.pointOnTrack = newPointOnTrack;
      axle.rotationIsReversed = newDirectionIsReversed;
      if (isDeadEnd) train.speed = 0;

      axle.rotationX += distance * axle.diameter;
    });

    // ボギーを輪軸に合わせる
    bogieToAxles(saveData, train, bogie);

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
  syncOtherBodies(saveData, train);

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
    axlesToBogie(saveData, train, fromBogie);
  });

  train.bogies.forEach(bogie => bogieToAxles(saveData, train, bogie));
}

export type ControlStandType = {
  directionIsReversed: boolean;
  reverser: number;
  masterController: OneHandleMasterController;
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
  uiOptionId: string;
};

export function getOneHandleMasterControllerOutput(saveData: SaveDataType, controlStand: ControlStandType) {
  // TODO Call different functions depending on the vehicle
  return getOneHandleMasterControllerSimpleOutput(saveData, controlStand);
}

export function getOneHandleMasterControllerSimpleOutput(saveData: SaveDataType, controlStand: ControlStandType) {
  const config = saveData.uiOneHandleMasterControllerConfigs[controlStand.masterController.uiOptionId];
  if (!config) return [0, 0];

  return [
    (controlStand.directionIsReversed ? -1 : 1) * controlStand.reverser * Math.max(0, 1 - controlStand.masterController.value / config.nValue),
    Math.max(0, (controlStand.masterController.value - config.nValue) / (config.maxValue - config.nValue))
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

export function getDistanceToNextStop(saveData: SaveDataType, train: Train, trackRoute: DiagramTrackRoute) {
  let distance: number | undefined;
  const pointOnTrack = train.bogies[0].axles[0].pointOnTrack;
  for (let i = 0; i < trackRoute.trackIds.length; i++) {
    if (trackRoute.trackIds[i] === pointOnTrack.trackId) {
      distance = getDistance(saveData, trackRoute.trackIds, trackRoute.stopOffset, pointOnTrack.length, i);
      break;
    }
  }

  return distance;
}