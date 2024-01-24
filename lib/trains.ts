import * as THREE from "three";
import { proxy } from "valtio";
import { getRelativePosition, eulerToCoordinate, coordinateToEuler } from './gis';
import { GameStateType, IdentifiedRecord } from "./game";
import { PointOnTrack, getLength, getPosition, getRotation } from "./tracks";

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
};

export type SerializableAxle = {
  pointOnTrack: PointOnTrack;
  z: number;
  position: THREE.Vector3Tuple;
  rotation: [number, number, number, THREE.EulerOrder];
  diameter: number;
  hasMotor: boolean;
};

export type CarBody = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  pointOnTrack: PointOnTrack;
  weight: number; // ton
  masterControllers: OneHandleMasterController[];
}

export type SerializableCarBody = {
  position: THREE.Vector3Tuple;
  rotation: [number, number, number, THREE.EulerOrder];
  pointOnTrack: PointOnTrack;
  weight: number;
  masterControllers: OneHandleMasterController[];
}

// 台車。CarBodyの一種
export type Bogie = CarBody & {
  axles: Axle[];
};

export type SerializableBogie = SerializableCarBody & {
  axles: SerializableAxle[];
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
  otherBodies: CarBody[]; // 台車を除くCarBody
  bodySupporterJoints: BodySupporterJoint[];
  otherJoints: Joint[]; // CarBody同士を接続するジョイント。連結器や、マレー式機関車の関節、複式ボギーの台車以外の接続に使う
  fromJointIndexes: number[];
  toJointIndexes: number[];
  globalPosition: THREE.Euler;
  speed: number; // m/s
  weight: number; // ton
  centroidZ: number; // 第一軸から重心に近い軌道上の相対位置
  motorCars: number;
};

export type SerializableTrain = IdentifiedRecord & {
  bogies: SerializableBogie[];
  otherBodies: SerializableCarBody[];
  bodySupporterJoints: SerializableBodySupporterJoint[];
  otherJoints: SerializableJoint[];
  speed: number;
  motorCars: number;
};

export const state = proxy<{
  hoveredTrainId: string;
  hoveredBodyIndex: number;
  activeTrainId: string;
  activeBodyIndex: number;
}>({
  hoveredTrainId: "",
  hoveredBodyIndex: -1,
  activeTrainId: "",
  activeBodyIndex: -1,
});

export function getGlobalEulerOfFirstAxle(gameState: GameStateType, axle: Axle) {
  return coordinateToEuler(gameState.tracks[axle.pointOnTrack.trackId].centerCoordinate || [0, 0])
}

export function createTrain(gameState: GameStateType, bogies: Bogie[], otherBodies: CarBody[] = [], bodySupporterJoints: BodySupporterJoint[] = [], otherJoints: Joint[] = [], speed = 0, weight?: number, motorCars?: number): Train {
  let weight_ = weight

  if (weight_ === undefined) {
    weight_ = 0
    bogies.forEach(bogie => weight_! += bogie.weight)
    otherBodies.forEach(body => weight_! += body.weight)

    if (weight_ === 0)
      weight_ = 30
  }

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

  let motorCars_ = motorCars
  if (motorCars_ === undefined) {
    motorCars_ = 0
    bogies.forEach(bogie => {
      bogie.axles.forEach(axle => {
        if (axle.hasMotor) motorCars_!++
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
    globalPosition: getGlobalEulerOfFirstAxle(gameState, bogies[0].axles[0]),
    speed,
    weight: weight_,
    centroidZ,
    motorCars: motorCars_,
  }

  calcJointsToRotateBody(train)

  placeTrain(gameState, train)

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

export function getAxlePosition(gameState: GameStateType, train: Train, axle: Axle) {
  const { pointOnTrack: { length } } = axle;

  const track = gameState.tracks[axle.pointOnTrack.trackId];
  const axleRelativePosition = getPosition(track.position, track.rotationY, length, track.radius);

  const globalTrackRelativePosition = getRelativePosition(
    track.centerCoordinate,
    train.globalPosition,
    undefined,
    0
  );

  return globalTrackRelativePosition.add(axleRelativePosition);
}

export function bogieToAxles(gameState: GameStateType, train: Train, bogie: Bogie) {
  const axlesCenterPosition = new THREE.Vector3();
  const firstAxlePosition = new THREE.Vector3();
  const lastAxlePosition = new THREE.Vector3();
  const up = new THREE.Vector3();

  for (let index = 0; index < bogie.axles.length; index++) {
    axlesCenterPosition.add(
      lastAxlePosition.copy(
        getAxlePosition(gameState, train, bogie.axles[index])
      )
    );

    up.add(new THREE.Vector3(0, 1));

    if (index === 0)
      firstAxlePosition.copy(lastAxlePosition);
  };

  bogie.position = axlesCenterPosition.divideScalar(bogie.axles.length);

  let forward: THREE.Vector3;
  if (2 <= bogie.axles.length) {
    forward = firstAxlePosition.sub(lastAxlePosition).normalize();
  } else {
    const track = gameState.tracks[bogie.axles[0].pointOnTrack.trackId];
    forward = new THREE.Vector3(1).applyEuler(getRotation(track.position, track.rotationY, bogie.axles[0].pointOnTrack.length, track.radius));
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

export function pointOnTrackToTrack(gameState: GameStateType, pointOnTrack: PointOnTrack, globalPosition: THREE.Euler, position: THREE.Vector3) {
  const track = gameState.tracks[pointOnTrack.trackId];

  // axle.pointOnTrack to track
  const globalTrackRelativePosition = getRelativePosition(
    track.centerCoordinate,
    globalPosition,
    undefined,
    0
  );

  pointOnTrack.length = getLength(position.clone().sub(globalTrackRelativePosition), track);
}

export function axlesToBogie(gameState: GameStateType, train: Train, bogie: Bogie) {
  bogie.axles.forEach(axle => {
    // axles to bogie
    axle.position.copy(new THREE.Vector3(0, 0, axle.z)
      .applyEuler(bogie.rotation)
      .add(bogie.position));
    axle.rotation.copy(bogie.rotation);

    // axle.pointOnTrack to track
    pointOnTrackToTrack(
      gameState,
      axle.pointOnTrack,
      train.globalPosition,
      axle.position,
    )
  });
}

export function axlesToBogies(gameState: GameStateType, train: Train) {
  train.bogies.forEach(bogie => axlesToBogie(gameState, train, bogie));

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

export function placeOtherBodies(gameState: GameStateType, train: Train) {
  train.otherBodies.forEach(otherBody => {
    const track = gameState.tracks[otherBody.pointOnTrack.trackId];
    const axleRelativePosition = getPosition(track.position, track.rotationY, otherBody.pointOnTrack.length, track.radius);

    const globalTrackRelativePosition = getRelativePosition(
      track.centerCoordinate,
      train.globalPosition,
      undefined,
      0
    );

    otherBody.position.copy(globalTrackRelativePosition.add(axleRelativePosition));

    otherBody.rotation.copy(getRotation(track.position, track.rotationY, otherBody.pointOnTrack.length, track.radius));
  });
}

export function syncOtherBodies(gameState: GameStateType, train: Train) {
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
      gameState,
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

export function placeTrain(gameState: GameStateType, train: Train) {
  // 連結器の向きを反転させないため
  placeOtherBodies(gameState, train);

  train.bogies.forEach(bogie => bogieToAxles(gameState, train, bogie));

  syncOtherBodies(gameState, train);

  train.bogies.forEach(fromBogie => axlesToBogie(gameState, train, fromBogie));
}

export function updateTime(gameState: GameStateType, train: Train, delta: number) {
  // 自動でマスコンと主制御器（Control System）を接続する
  let accel = 0
  let brake = 1
  train.bogies.forEach(bogie => {
    bogie.masterControllers.forEach(masterController => {
      const [accel1, brake1] = getOneHandleMasterControllerOutput(gameState, masterController)

      accel = Math.max(accel, accel1)
      brake = Math.min(brake, brake1)
    })
  })
  train.otherBodies.forEach(body => {
    body.masterControllers.forEach(masterController => {
      const [accel1, brake1] = getOneHandleMasterControllerOutput(gameState, masterController)

      accel = Math.max(accel, accel1)
      brake = Math.min(brake, brake1)
    })
  })

  const speedKMH = train.speed * 3.6

  // Accel
  //const fieldCoil = 1 // TODO 界磁 (0-1)
  const tractiveForce = getTractiveForcePerMotorCars(train.speed/*, fieldCoil*/) // 牽引力 (引張力, kg)
  const a = 30.9

  //const acceleration = 3.0 / 3.6 // 3.0 km/h/s
  let acceleration = accel * tractiveForce * train.motorCars / train.weight / a / 3.6 // m/s/s

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
  /*const track = gameState.tracks[train.bogies[0].axles[0].pointOnTrack.trackId]
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
  rollAxles(gameState, train, train.speed * delta)
}

export function rollAxles(gameState: GameStateType, train: Train, distance: number) {
  let oldBogiesInvertedQuaternion = getBogiesQuaternion(train).invert();

  const center = new THREE.Vector3();
  const newCenter = new THREE.Vector3();
  train.bogies.forEach(bogie => {
    center.add(bogie.position);

    // 輪軸を転がす
    bogie.axles.forEach(axle => {
      axle.pointOnTrack.length += distance;

      if (axle.pointOnTrack.length < 0) {
        const track = gameState.tracks[axle.pointOnTrack.trackId];
        if (track.idOfTrackOrSwitchConnectedFromStart) {
          if (track.connectedFromStartIsTrack) {
            const connectedTo = gameState.tracks[track.idOfTrackOrSwitchConnectedFromStart];
            if (connectedTo.connectedFromStartIsToEnd) {
              axle.pointOnTrack = {
                trackId: track.idOfTrackOrSwitchConnectedFromStart,
                length: connectedTo.length + axle.pointOnTrack.length,
              };
            } else {
              axle.pointOnTrack = {
                trackId: track.idOfTrackOrSwitchConnectedFromStart,
                length: -axle.pointOnTrack.length,
              };
              // TODO この輪軸の回転方向を反転
            }
          } else {
            const railroadSwitch = gameState.switches[track.idOfTrackOrSwitchConnectedFromStart];
            if (!railroadSwitch || railroadSwitch.currentConnected === -1) {
              // TODO 接続先がない場合
            } else {
              const connectedTo = gameState.tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];
              if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
                axle.pointOnTrack = {
                  trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
                  length: connectedTo.length + axle.pointOnTrack.length,
                };
              } else {
                axle.pointOnTrack = {
                  trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
                  length: -axle.pointOnTrack.length,
                };
                // TODO この輪軸の回転方向を反転
              }
            }
          }
        } else {
          // TODO 接続先がない場合
        }
      } else {
        const track = gameState.tracks[axle.pointOnTrack.trackId];
        if (track.length < axle.pointOnTrack.length) {
          if (track.idOfTrackOrSwitchConnectedFromEnd) {
            if (track.connectedFromEndIsTrack) {
              const connectedTo = gameState.tracks[track.idOfTrackOrSwitchConnectedFromEnd];
              if (connectedTo.connectedFromEndIsToEnd) {
                axle.pointOnTrack = {
                  trackId: track.idOfTrackOrSwitchConnectedFromEnd,
                  length: connectedTo.length + track.length - axle.pointOnTrack.length,
                };
                // TODO この輪軸の回転方向を反転
              } else {
                axle.pointOnTrack = {
                  trackId: track.idOfTrackOrSwitchConnectedFromEnd,
                  length: axle.pointOnTrack.length - track.length,
                };
              }
            } else {
              const railroadSwitch = gameState.switches[track.idOfTrackOrSwitchConnectedFromEnd];
              if (!railroadSwitch || railroadSwitch.currentConnected === -1) {
                // TODO 接続先がない場合
              } else {
                const connectedTo = gameState.tracks[railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected]];
                if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
                  axle.pointOnTrack = {
                    trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
                    length: connectedTo.length + track.length - axle.pointOnTrack.length,
                  };
                  // TODO この輪軸の回転方向を反転
                } else {
                  axle.pointOnTrack = {
                    trackId: railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected],
                    length: axle.pointOnTrack.length - track.length,
                  };
                }
              }
            }
          } else {
            // TODO 接続先がない場合
          }
        }
      }

      axle.rotationX += distance * axle.diameter;
    });

    // ボギーを輪軸に合わせる
    bogieToAxles(gameState, train, bogie);

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
  syncOtherBodies(gameState, train);

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
    axlesToBogie(gameState, train, fromBogie);
  });

  train.bogies.forEach(bogie => bogieToAxles(gameState, train, bogie));
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

export function getOneHandleMasterControllerOutput(gameState: GameStateType, masterController: OneHandleMasterController) {
  // TODO Call different functions depending on the vehicle
  return getOneHandleMasterControllerSimpleOutput(gameState, masterController);
}

export function getOneHandleMasterControllerSimpleOutput(gameState: GameStateType, masterController: OneHandleMasterController) {
  const config = gameState.uiOneHandleMasterControllerConfigs[masterController.uiOptionId];

  return [Math.max(0, 1 - masterController.value / config.nValue), Math.max(0, (masterController.value - config.nValue) / (config.maxValue - config.nValue))];
}

export function getTractiveForcePerMotorCars(speed: number/*, fieldCoil: number*/) {
  // TODO Call different functions depending on the vehicle
  return getTractiveForcePerMotorCarsJNR103Series(speed)
}

export function getTractiveForcePerMotorCarsJNR103Series(speed: number/*, fieldCoil: number*/) {
  // TODO 性能曲線（力行ノッチ曲線）を追加する
  return 4500
}