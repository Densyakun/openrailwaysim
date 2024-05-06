import * as React from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { proxy, useSnapshot } from 'valtio';
import { TextField } from '@mui/material';
import { coordinateToEuler, getRelativePosition } from '@/lib/gis';
import centroid from '@turf/centroid';
import { SerializableSwitch, SerializableTrack, SerializableTransitionCurve, TOLERANCE_FOR_TRACK_CONNECTIONS, Track, TransitionCurve, TransitionCurveData, getPosition, getTransitionCurveData, state as tracksState } from '@/lib/tracks';
import { lineString } from '@turf/helpers';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game';
import { featureCollectionsSubMenuState, onClickCurve } from './FeatureCollectionsSubMenu';

export type NextCurveEditStateType = {
  addingCurves: (Track | undefined)[]; // 単曲線
  addingTransitionsAB: (TransitionCurve | undefined)[]; // AB側の緩和曲線
  addingTransitionsCD: (TransitionCurve | undefined)[]; // CD側の緩和曲線
  S: number[]; // ベクトルABの係数
  T: number[]; // ベクトルCDの係数
}

export type CurveEditStateType = {
  AB: Track | undefined;
  CD: Track | undefined;
  ABLength: number;
  CDLength: number;
  curveRadius: number;
  transitionABLength: number;
  transitionCDLength: number;
  rotationX: number;
}

export const curveEditMenuState = proxy<NextCurveEditStateType & CurveEditStateType>({
  addingCurves: [],
  addingTransitionsAB: [],
  addingTransitionsCD: [],
  S: [],
  T: [],
  AB: undefined,
  CD: undefined,
  ABLength: 0,
  CDLength: 0,
  curveRadius: 400,
  transitionABLength: 60,
  transitionCDLength: 60,
  rotationX: 0.0963,
});

export function updateAddingTracks() {
  const AB = curveEditMenuState.AB;
  const CD = curveEditMenuState.CD;
  if (!AB || !CD) return;

  const centerCoordinate = centroid(lineString([AB.centerCoordinate, CD.centerCoordinate])).geometry.coordinates;
  const centerCoordinateEuler = coordinateToEuler(centerCoordinate);

  const ABCenterCoordinate = getRelativePosition(AB.centerCoordinate, centerCoordinateEuler, centerCoordinate, 0);
  const CDCenterCoordinate = getRelativePosition(CD.centerCoordinate, centerCoordinateEuler, centerCoordinate, 0);

  const pointA = ABCenterCoordinate.clone().add(AB.position);
  const pointB = ABCenterCoordinate.clone().add(getPosition(AB, AB.length));
  const pointC = CDCenterCoordinate.clone().add(CD.position);
  const pointD = CDCenterCoordinate.clone().add(getPosition(CD, CD.length));

  const ABVector = pointB.clone().sub(pointA);
  const CDVector = pointD.clone().sub(pointC);
  const rotationYAB = Math.atan2(-ABVector.z, ABVector.x);
  const rotationYCD = Math.atan2(-CDVector.z, CDVector.x);

  // 単曲線を作成する
  let ABOffset = curveEditMenuState.curveRadius;
  let CDOffset = curveEditMenuState.curveRadius;

  let curveRad = rotationYCD - rotationYAB;
  curveRad -= Math.floor((curveRad + Math.PI) / (Math.PI * 2)) * Math.PI * 2; // 値の範囲を -Math.PI <= rad < Math.PI にする

  let transitionRad = 0;
  let transitionRadAB = 0;

  let transitionCurveAB: TransitionCurveData = undefined!;
  if (curveEditMenuState.transitionABLength !== 0) {
    transitionCurveAB = getTransitionCurveData(0, 1 / curveEditMenuState.curveRadius, curveEditMenuState.transitionABLength);

    ABOffset = curveEditMenuState.curveRadius * Math.cos(transitionCurveAB.endRotationY) - transitionCurveAB.endPosition.z;

    transitionRad += transitionCurveAB.endRotationY;
    transitionRadAB += transitionCurveAB.endRotationY;
  }

  let transitionCurveCD: TransitionCurveData;
  if (curveEditMenuState.transitionCDLength !== 0) {
    transitionCurveCD = getTransitionCurveData(0, 1 / curveEditMenuState.curveRadius, curveEditMenuState.transitionCDLength);

    CDOffset = curveEditMenuState.curveRadius * Math.cos(transitionCurveCD.endRotationY) - transitionCurveCD.endPosition.z;

    transitionRad += transitionCurveCD.endRotationY;
  }

  const ABOffsetVector = new THREE.Vector3(0, 0, ABOffset).applyEuler(new THREE.Euler(0, rotationYAB));
  const CDOffsetVector = new THREE.Vector3(0, 0, CDOffset).applyEuler(new THREE.Euler(0, rotationYCD));

  const pointOffsetAL = pointA.clone().sub(ABOffsetVector);
  const pointOffsetBL = pointB.clone().sub(ABOffsetVector);
  const pointOffsetCL = pointC.clone().sub(CDOffsetVector);
  const pointOffsetDL = pointD.clone().sub(CDOffsetVector);
  const pointOffsetAR = pointA.clone().add(ABOffsetVector);
  const pointOffsetBR = pointB.clone().add(ABOffsetVector);
  const pointOffsetCR = pointC.clone().add(CDOffsetVector);
  const pointOffsetDR = pointD.clone().add(CDOffsetVector);

  const curveSLL = ((pointOffsetCL.x - pointOffsetAL.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetCL.z - pointOffsetAL.z) * (pointOffsetDL.x - pointOffsetCL.x))
    / ((pointOffsetBL.x - pointOffsetAL.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetBL.z - pointOffsetAL.z) * (pointOffsetDL.x - pointOffsetCL.x));
  const curveSLR = ((pointOffsetCR.x - pointOffsetAL.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetCR.z - pointOffsetAL.z) * (pointOffsetDR.x - pointOffsetCR.x))
    / ((pointOffsetBL.x - pointOffsetAL.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetBL.z - pointOffsetAL.z) * (pointOffsetDR.x - pointOffsetCR.x));
  const curveSRL = ((pointOffsetCL.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetCL.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x));
  const curveSRR = ((pointOffsetCR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetCR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x));

  const circleCenterLL = pointOffsetAL.clone().add(pointOffsetBL.clone().sub(pointOffsetAL).multiplyScalar(curveSLL));
  const circleCenterLR = pointOffsetAL.clone().add(pointOffsetBL.clone().sub(pointOffsetAL).multiplyScalar(curveSLR));
  const circleCenterRL = pointOffsetAR.clone().add(pointOffsetBR.clone().sub(pointOffsetAR).multiplyScalar(curveSRL));
  const circleCenterRR = pointOffsetAR.clone().add(pointOffsetBR.clone().sub(pointOffsetAR).multiplyScalar(curveSRR));

  // TODO grade

  const ABOffsetVector1 = new THREE.Vector3(0, 0, curveEditMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYAB + transitionRadAB));
  const ABOffsetVector2 = new THREE.Vector3(0, 0, curveEditMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYAB - transitionRadAB));

  const curves = 0 <= curveRad
    ? [
      {
        position: circleCenterLL.clone().add(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (Math.PI * 2 - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterLL.clone().add(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (Math.PI * 2 - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
    ]
    : [
      {
        position: circleCenterLL.clone().add(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (Math.PI * 2 + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (-curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterLL.clone().add(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (-curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector2),
        length: curveEditMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector1),
        length: curveEditMenuState.curveRadius * (Math.PI * 2 + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
    ];

  curveEditMenuState.addingCurves = curves.map((curve, index) => {
    if (curve.length <= 0) return;

    return {
      ...curve,
      centerCoordinate,
      radius: 2 <= index && index < 6 ? curveEditMenuState.curveRadius : -curveEditMenuState.curveRadius,
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
      beginRotationX: 2 <= index && index < 6 ? curveEditMenuState.rotationX : -curveEditMenuState.rotationX,
      endRotationX: 2 <= index && index < 6 ? curveEditMenuState.rotationX : -curveEditMenuState.rotationX,
    } as Track;
  });

  curveEditMenuState.ABLength = ABVector.length();

  // 緩和曲線を作成する
  if (curveEditMenuState.transitionABLength === 0) {
    // AB側に緩和曲線がない場合、直線の接合点を曲線の始点にする
    curveEditMenuState.S = [
      curveSLL,
      curveSLR,
      curveSRL,
      curveSRR,
      curveSLL,
      curveSLR,
      curveSRL,
      curveSRR,
    ];

    curveEditMenuState.addingTransitionsAB = curveEditMenuState.addingCurves.map(() => undefined);
  } else {
    // AB側に緩和曲線がある場合、直線の接合点を緩和曲線の始点にする
    curveEditMenuState.S = curveEditMenuState.addingCurves.map((curve, index) =>
      curve ?
        index < 4 ? curve.position.clone()
          .sub(pointA).applyEuler(new THREE.Euler(0, -rotationYAB))
          .sub(transitionCurveAB.endPosition).x / curveEditMenuState.ABLength
          : curve.position.clone()
            .sub(pointA).applyEuler(new THREE.Euler(0, -rotationYAB))
            .add(transitionCurveAB.endPosition).x / curveEditMenuState.ABLength
        : 0
    );

    curveEditMenuState.addingTransitionsAB = curveEditMenuState.addingCurves.map((curve, index) => {
      if (!curve) return;

      return {
        ...curve,
        ...transitionCurveAB,
        position: pointA.clone().add(ABVector.clone().multiplyScalar(curveEditMenuState.S[index])),
        rotationY: 0 <= index && index < 4 ? rotationYAB : rotationYAB - Math.PI,
        length: curveEditMenuState.transitionABLength,
        curveDirection: index === 0 || index === 1 || index === 6 || index === 7 ? true : false,
      };
    });
  }

  const curveTLL = ((pointOffsetAL.x - pointOffsetCL.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetAL.z - pointOffsetCL.z) * (pointOffsetBL.x - pointOffsetAL.x))
    / ((pointOffsetDL.x - pointOffsetCL.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetDL.z - pointOffsetCL.z) * (pointOffsetBL.x - pointOffsetAL.x));
  const curveTLR = ((pointOffsetAL.x - pointOffsetCR.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetAL.z - pointOffsetCR.z) * (pointOffsetBL.x - pointOffsetAL.x))
    / ((pointOffsetDR.x - pointOffsetCR.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetDR.z - pointOffsetCR.z) * (pointOffsetBL.x - pointOffsetAL.x));
  const curveTRL = ((pointOffsetAR.x - pointOffsetCL.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetAR.z - pointOffsetCL.z) * (pointOffsetBR.x - pointOffsetAR.x))
    / ((pointOffsetDL.x - pointOffsetCL.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetDL.z - pointOffsetCL.z) * (pointOffsetBR.x - pointOffsetAR.x));
  const curveTRR = ((pointOffsetAR.x - pointOffsetCR.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetAR.z - pointOffsetCR.z) * (pointOffsetBR.x - pointOffsetAR.x))
    / ((pointOffsetDR.x - pointOffsetCR.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetDR.z - pointOffsetCR.z) * (pointOffsetBR.x - pointOffsetAR.x));

  curveEditMenuState.CDLength = CDVector.length();

  if (curveEditMenuState.transitionCDLength === 0) {
    // CD側に緩和曲線がない場合、直線の接合点を曲線の終点にする
    curveEditMenuState.T = [
      curveTLL,
      curveTLR,
      curveTRL,
      curveTRR,
      curveTLL,
      curveTLR,
      curveTRL,
      curveTRR,
    ];

    curveEditMenuState.addingTransitionsCD = curveEditMenuState.addingCurves.map(() => undefined);
  } else {
    // CD側に緩和曲線がある場合、直線の接合点を緩和曲線の始点にする
    curveEditMenuState.T = curveEditMenuState.addingCurves.map((curve, index) => {
      if (!curve) return 0;
      const curveEndPos = getPosition(curve, curve.length);
      return index === 1 || index === 2 || index === 4 || index === 7 ? curveEndPos
        .sub(pointC).applyEuler(new THREE.Euler(0, -rotationYCD))
        .sub(transitionCurveCD.endPosition)
        .x / curveEditMenuState.CDLength
        : curveEndPos
          .sub(pointC).applyEuler(new THREE.Euler(0, -rotationYCD))
          .add(transitionCurveCD.endPosition).x / curveEditMenuState.CDLength;
    });

    curveEditMenuState.addingTransitionsCD = curveEditMenuState.addingCurves.map((curve, index) => {
      if (!curve) return;

      return {
        ...curve,
        ...transitionCurveCD,
        position: pointC.clone().add(CDVector.clone().multiplyScalar(curveEditMenuState.T[index])),
        rotationY: index === 1 || index === 2 || index === 4 || index === 7 ? rotationYCD : rotationYCD - Math.PI,
        length: curveEditMenuState.transitionCDLength,
        curveDirection: 2 <= index && index < 6 ? true : false,
      };
    });
  }
}

export function onClickAddingTrack(curveIndex: number) {
  const AB = curveEditMenuState.AB;
  const CD = curveEditMenuState.CD;
  const curve = curveEditMenuState.addingCurves[curveIndex];
  if (!AB || !CD || !curve) return;

  const s = curveEditMenuState.S[curveIndex];
  const t = curveEditMenuState.T[curveIndex];

  const transitionCurveAB = curveEditMenuState.addingTransitionsAB[curveIndex];
  const transitionCurveCD = curveEditMenuState.addingTransitionsCD[curveIndex];

  if (featureCollectionsSubMenuState.straightTracks.length) {
    // FeatureCollectionsSubMenu で LineString から曲線を作成する場合
    onClickCurve(
      curveIndex,
      s,
      t,
      curve,
      transitionCurveAB,
      transitionCurveCD,
    );
    return;
  }

  // 2つの軌道から曲線を作成する場合
  const ABId = tracksState.selectedTrackIds[0];
  const CDId = tracksState.selectedTrackIds[1];

  connectTwoStraightLinesWithCurve(AB, ABId, CD, CDId, curveIndex, s, t, curve, transitionCurveAB, transitionCurveCD);
}

export function connectTwoStraightLinesWithCurve(AB: Track, ABId: string, CD: Track, CDId: string, curveIndex: number, s: number, t: number, curve: Track, transitionCurveAB?: TransitionCurve, transitionCurveCD?: TransitionCurve) {
  const curveId = uuidv4();

  const serializableCurve: SerializableTrack = {
    id: curveId,
    centerCoordinate: curve.centerCoordinate,
    position: curve.position.toArray(),
    rotationY: curve.rotationY,
    length: curve.length,
    radius: curve.radius,
    /*startGrade: 0, // TODO grade
    endGrade: 0,*/
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginRotationX: curve.beginRotationX,
    endRotationX: curve.endRotationX,
    modelPaths: AB.modelPaths,
  }

  const transitionCurveABId = uuidv4();

  const serializableTransitionCurveAB: SerializableTransitionCurve | undefined = transitionCurveAB && {
    id: transitionCurveABId,
    centerCoordinate: transitionCurveAB.centerCoordinate,
    position: transitionCurveAB.position.toArray(),
    rotationY: transitionCurveAB.rotationY,
    length: transitionCurveAB.length,
    radius: transitionCurveAB.radius,
    /*startGrade: 0, // TODO grade
    endGrade: 0,*/
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginRotationX: AB.beginRotationX,
    endRotationX: curve.beginRotationX,
    modelPaths: AB.modelPaths,
    beginCurvature: transitionCurveAB.beginCurvature,
    endCurvature: transitionCurveAB.endCurvature,
    endPosition: transitionCurveAB.endPosition.toArray(),
    endRotationY: transitionCurveAB.endRotationY,
    transitionCurves: transitionCurveAB.transitionCurves.map(value => ({
      position: value.position.toArray(),
      rotationY: value.rotationY,
      curvature: value.curvature,
    })),
    curveDirection: transitionCurveAB.curveDirection,
  };

  const transitionCurveCDId = uuidv4();

  const serializableTransitionCurveCD: SerializableTransitionCurve | undefined = transitionCurveCD && {
    id: transitionCurveCDId,
    centerCoordinate: transitionCurveCD.centerCoordinate,
    position: transitionCurveCD.position.toArray(),
    rotationY: transitionCurveCD.rotationY,
    length: transitionCurveCD.length,
    radius: transitionCurveCD.radius,
    /*startGrade: 0, // TODO grade
    endGrade: 0,*/
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginRotationX: curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7 ? CD.beginRotationX : -CD.beginRotationX,
    endRotationX: -curve.endRotationX,
    modelPaths: CD.modelPaths,
    beginCurvature: transitionCurveCD.beginCurvature,
    endCurvature: transitionCurveCD.endCurvature,
    endPosition: transitionCurveCD.endPosition.toArray(),
    endRotationY: transitionCurveCD.endRotationY,
    transitionCurves: transitionCurveCD.transitionCurves.map(value => ({
      position: value.position.toArray(),
      rotationY: value.rotationY,
      curvature: value.curvature,
    })),
    curveDirection: transitionCurveCD.curveDirection,
  };

  const s_ = s * AB.length;
  const t_ = t * CD.length;

  // ABと接続する
  if (s_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    // ABの始点と接続する場合
    let track0IsChanged = false;

    if (curveIndex < 4) {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [ABId, serializableTransitionCurveAB ? transitionCurveABId : curveId],
          isConnectedToEnd: [false, false],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    } else {
      AB.idOfTrackOrSwitchConnectedFromStart = serializableTransitionCurveAB ? transitionCurveABId : curveId;
      AB.connectedFromStartIsTrack = true;
      AB.connectedFromStartIsToEnd = false;
      const connectedTrack = serializableTransitionCurveAB || serializableCurve;
      connectedTrack.idOfTrackOrSwitchConnectedFromStart = ABId;
      connectedTrack.connectedFromStartIsTrack = true;
      connectedTrack.connectedFromStartIsToEnd = false;

      track0IsChanged = true;
    }

    if (s < 0) {
      AB.position = getPosition(AB, AB.length * s);
      AB.length *= 1 - s;

      track0IsChanged = true;
    }

    if (track0IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", ABId], AB)
      ]]));
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= s_ - AB.length) {
    // ABの終点と接続する場合
    let track0IsChanged = false;

    if (curveIndex < 4) {
      AB.idOfTrackOrSwitchConnectedFromEnd = serializableTransitionCurveAB ? transitionCurveABId : curveId;
      AB.connectedFromEndIsTrack = true;
      AB.connectedFromEndIsToEnd = false;
      const connectedTrack = serializableTransitionCurveAB || serializableCurve;
      connectedTrack.idOfTrackOrSwitchConnectedFromStart = ABId;
      connectedTrack.connectedFromStartIsTrack = true;
      connectedTrack.connectedFromStartIsToEnd = true;

      track0IsChanged = true;
    } else {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [ABId, serializableTransitionCurveAB ? transitionCurveABId : curveId],
          isConnectedToEnd: [true, false],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    }

    if (1 < s) {
      AB.length *= s;

      track0IsChanged = true;
    }

    if (track0IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", ABId], AB)
      ]]));
  } else {
    // ABの途中に分岐器を追加する場合
    let trackB: SerializableTrack; // 分岐器の直進側

    const railroadSwitch: SerializableSwitch = {
      id: uuidv4(),
      connectedTrackIds: [],
      isConnectedToEnd: [],
      currentConnected: -1,
    };

    if (curveIndex < 4) {
      trackB = {
        id: uuidv4(),
        centerCoordinate: AB.centerCoordinate,
        position: getPosition(AB, AB.length * s).toArray(),
        rotationY: AB.rotationY,
        length: AB.length * (1 - s),
        radius: 0,
        /*startGrade: 0, // TODO grade
        endGrade: 0,*/
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
        beginRotationX: AB.beginRotationX,
        endRotationX: AB.beginRotationX,
        modelPaths: AB.modelPaths,
      }

      AB.length *= s;

      // 直進側を開通する
      railroadSwitch.connectedTrackIds = [trackB.id, serializableTransitionCurveAB ? transitionCurveABId : curveId];
      railroadSwitch.isConnectedToEnd = [false, false];
      railroadSwitch.currentConnected = 0;

      trackB.idOfTrackOrSwitchConnectedFromEnd = AB.idOfTrackOrSwitchConnectedFromEnd;
      trackB.connectedFromEndIsTrack = AB.connectedFromEndIsTrack;
      trackB.connectedFromEndIsToEnd = AB.connectedFromEndIsToEnd;

      AB.idOfTrackOrSwitchConnectedFromEnd = railroadSwitch.id;
      AB.connectedFromEndIsTrack = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = ABId;
      trackB.connectedFromStartIsTrack = true;
      trackB.connectedFromStartIsToEnd = true;
    } else {
      trackB = {
        id: uuidv4(),
        centerCoordinate: AB.centerCoordinate,
        position: getPosition(AB, 0).toArray(),
        rotationY: AB.rotationY,
        length: AB.length * s,
        radius: 0,
        /*startGrade: 0, // TODO grade
        endGrade: 0,*/
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
        beginRotationX: AB.beginRotationX,
        endRotationX: AB.beginRotationX,
        modelPaths: AB.modelPaths,
      }

      AB.position = getPosition(AB, AB.length * s);
      AB.length *= (1 - s);

      railroadSwitch.connectedTrackIds = [trackB.id, serializableTransitionCurveAB ? transitionCurveABId : curveId];
      railroadSwitch.isConnectedToEnd = [true, false];
      railroadSwitch.currentConnected = 0;

      trackB.idOfTrackOrSwitchConnectedFromStart = AB.idOfTrackOrSwitchConnectedFromStart;
      trackB.connectedFromStartIsTrack = AB.connectedFromStartIsTrack;
      trackB.connectedFromStartIsToEnd = AB.connectedFromStartIsToEnd;

      trackB.idOfTrackOrSwitchConnectedFromEnd = ABId;
      trackB.connectedFromEndIsTrack = true;
      trackB.connectedFromEndIsToEnd = false;
      AB.idOfTrackOrSwitchConnectedFromStart = railroadSwitch.id;
      AB.connectedFromStartIsTrack = false;
    }

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", trackB]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
      "tracks",
      toSerializableProp(["tracks", ABId], AB)
    ]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["switches", railroadSwitch]]));
  }

  // CDと接続する
  if (t_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    let track1IsChanged = false;

    if (curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7) {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [CDId, serializableTransitionCurveCD ? transitionCurveCDId : curveId],
          isConnectedToEnd: [false, false],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    } else {
      CD.idOfTrackOrSwitchConnectedFromStart = serializableTransitionCurveCD ? transitionCurveCDId : curveId;
      CD.connectedFromStartIsTrack = true;
      CD.connectedFromStartIsToEnd = serializableTransitionCurveCD ? false : true;
      if (serializableTransitionCurveCD) {
        serializableTransitionCurveCD.idOfTrackOrSwitchConnectedFromStart = CDId;
        serializableTransitionCurveCD.connectedFromStartIsTrack = true;
        serializableTransitionCurveCD.connectedFromStartIsToEnd = false;
      } else {
        serializableCurve.idOfTrackOrSwitchConnectedFromEnd = CDId;
        serializableCurve.connectedFromEndIsTrack = true;
        serializableCurve.connectedFromEndIsToEnd = false;
      }

      track1IsChanged = true;
    }

    if (t < 0) {
      CD.position = getPosition(CD, CD.length * t);
      CD.length *= 1 - t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", CDId], CD)
      ]]));
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= t_ - CD.length) {
    let track1IsChanged = false;

    if (curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7) {
      CD.idOfTrackOrSwitchConnectedFromEnd = serializableTransitionCurveCD ? transitionCurveCDId : curveId;
      CD.connectedFromEndIsTrack = true;
      CD.connectedFromEndIsToEnd = serializableTransitionCurveCD ? false : true;
      if (serializableTransitionCurveCD) {
        serializableTransitionCurveCD.idOfTrackOrSwitchConnectedFromStart = CDId;
        serializableTransitionCurveCD.connectedFromStartIsTrack = true;
        serializableTransitionCurveCD.connectedFromStartIsToEnd = true;
      } else {
        serializableCurve.idOfTrackOrSwitchConnectedFromEnd = CDId;
        serializableCurve.connectedFromEndIsTrack = true;
        serializableCurve.connectedFromEndIsToEnd = true;
      }

      track1IsChanged = true;
    } else {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [CDId, serializableTransitionCurveCD ? transitionCurveCDId : curveId],
          isConnectedToEnd: [true, serializableTransitionCurveCD ? false : true],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    }

    if (1 < t) {
      CD.length *= t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", CDId], CD)
      ]]));
  } else {
    let trackB: SerializableTrack;

    const railroadSwitch: SerializableSwitch = {
      id: uuidv4(),
      connectedTrackIds: [],
      isConnectedToEnd: [],
      currentConnected: -1,
    };

    if (curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7) {
      trackB = {
        id: uuidv4(),
        centerCoordinate: CD.centerCoordinate,
        position: getPosition(CD, CD.length * t).toArray(),
        rotationY: CD.rotationY,
        length: CD.length * (1 - t),
        radius: 0,
        /*startGrade: 0, // TODO grade
        endGrade: 0,*/
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
        beginRotationX: CD.beginRotationX,
        endRotationX: CD.beginRotationX,
        modelPaths: CD.modelPaths,
      }

      CD.length *= t;

      railroadSwitch.connectedTrackIds = [trackB.id, serializableTransitionCurveCD ? transitionCurveCDId : curveId];
      railroadSwitch.isConnectedToEnd = [false, serializableTransitionCurveCD ? false : true];
      railroadSwitch.currentConnected = 0;

      trackB.idOfTrackOrSwitchConnectedFromEnd = CD.idOfTrackOrSwitchConnectedFromEnd;
      trackB.connectedFromEndIsTrack = CD.connectedFromEndIsTrack;
      trackB.connectedFromEndIsToEnd = CD.connectedFromEndIsToEnd;

      CD.idOfTrackOrSwitchConnectedFromEnd = railroadSwitch.id;
      CD.connectedFromEndIsTrack = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = CDId;
      trackB.connectedFromStartIsTrack = true;
      trackB.connectedFromStartIsToEnd = true;
    } else {
      trackB = {
        id: uuidv4(),
        centerCoordinate: CD.centerCoordinate,
        position: getPosition(CD, 0).toArray(),
        rotationY: CD.rotationY,
        length: CD.length * t,
        radius: 0,
        /*startGrade: 0, // TODO grade
        endGrade: 0,*/
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
        beginRotationX: CD.beginRotationX,
        endRotationX: CD.beginRotationX,
        modelPaths: CD.modelPaths,
      }

      CD.position = getPosition(CD, CD.length * t);
      CD.length *= (1 - t);

      railroadSwitch.connectedTrackIds = [trackB.id, serializableTransitionCurveCD ? transitionCurveCDId : curveId];
      railroadSwitch.isConnectedToEnd = [true, serializableTransitionCurveCD ? false : true];
      railroadSwitch.currentConnected = 0;

      trackB.idOfTrackOrSwitchConnectedFromStart = CD.idOfTrackOrSwitchConnectedFromStart;
      trackB.connectedFromStartIsTrack = CD.connectedFromStartIsTrack;
      trackB.connectedFromStartIsToEnd = CD.connectedFromStartIsToEnd;

      CD.idOfTrackOrSwitchConnectedFromStart = railroadSwitch.id;
      CD.connectedFromStartIsTrack = false;
      trackB.idOfTrackOrSwitchConnectedFromEnd = CDId;
      trackB.connectedFromEndIsTrack = true;
      trackB.connectedFromEndIsToEnd = false;
    }

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", trackB]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
      "tracks",
      toSerializableProp(["tracks", CDId], CD)
    ]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["switches", railroadSwitch]]));
  }

  // 緩和曲線と単曲線を接続する
  if (serializableTransitionCurveAB) {
    serializableTransitionCurveAB.idOfTrackOrSwitchConnectedFromEnd = curveId;
    serializableTransitionCurveAB.connectedFromEndIsTrack = true;
    serializableTransitionCurveAB.connectedFromEndIsToEnd = false;
    serializableCurve.idOfTrackOrSwitchConnectedFromStart = transitionCurveABId;
    serializableCurve.connectedFromStartIsTrack = true;
    serializableCurve.connectedFromStartIsToEnd = true;
  }
  if (serializableTransitionCurveCD) {
    serializableTransitionCurveCD.idOfTrackOrSwitchConnectedFromEnd = curveId;
    serializableTransitionCurveCD.connectedFromEndIsTrack = true;
    serializableTransitionCurveCD.connectedFromEndIsToEnd = true;
    serializableCurve.idOfTrackOrSwitchConnectedFromEnd = transitionCurveCDId;
    serializableCurve.connectedFromEndIsTrack = true;
    serializableCurve.connectedFromEndIsToEnd = true;
  }

  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", serializableCurve]]));
  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", serializableTransitionCurveAB]]));
  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", serializableTransitionCurveCD]]));

  updateAddingTracks();
}

export default function CurveEditMenu() {
  useSnapshot(tracksState);
  useSnapshot(curveEditMenuState);

  React.useEffect(() => updateAddingTracks(), []);

  return (
    <>
      <TextField
        label="Radius"
        defaultValue={curveEditMenuState.curveRadius}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const radius = parseFloat(event.target.value);
          if (Number.isNaN(radius) || radius === 0) return;

          curveEditMenuState.curveRadius = Math.max(-radius, radius);
          updateAddingTracks();
        }}
      />
      <TextField
        label="Transition length 1"
        defaultValue={curveEditMenuState.transitionABLength}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const length = parseFloat(event.target.value);
          if (Number.isNaN(length)) return;

          curveEditMenuState.transitionABLength = Math.max(0, length);
          updateAddingTracks();
        }}
      />
      <TextField
        label="Transition length 2"
        defaultValue={curveEditMenuState.transitionCDLength}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const length = parseFloat(event.target.value);
          if (Number.isNaN(length)) return;

          curveEditMenuState.transitionCDLength = Math.max(0, length);
          updateAddingTracks();
        }}
      />
      <TextField
        label="Rotation X"
        defaultValue={curveEditMenuState.rotationX}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const rotationX = parseFloat(event.target.value);
          if (Number.isNaN(rotationX)) return;

          curveEditMenuState.rotationX = rotationX;
          updateAddingTracks();
        }}
      />
    </>
  );
}
