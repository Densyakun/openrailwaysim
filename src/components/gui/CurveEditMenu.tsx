import * as React from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { useSnapshot } from 'valtio';
import { TextField } from '@mui/material';
import { SerializableTrack, SerializableTransitionCurve, Switch, TOLERANCE_FOR_TRACK_CONNECTIONS, Track, TransitionCurve, TransitionCurveData, applyTransitionCurveToSerializableTrack, connectTwoTracks, createSerializableTrackBasedOnTrack, getPosition, getTransitionCurveData } from '@/lib/tracks';
import { socket } from '../Client';
import { Path, PathValue, SerializableSaveDataType, toSerializableSaveData, trackTypeId } from '@/lib/game';
import { featureCollectionsTabPanelState, onClickCurve } from './FeatureCollectionsTabPanel';
import { tracksState } from '@/lib/client/tracks';
import { MessageCode, send } from '@/lib/ws';
import { curveEditMenuState } from '@/lib/client/curveEditMenu';
import { gameState } from '@/lib/client/client';

export function updateAddingTracks() {
  const AB = curveEditMenuState.AB;
  const CD = curveEditMenuState.CD;
  if (!AB || !CD) return;

  const pointA = getPosition(AB, 0);
  const pointB = getPosition(AB, AB.length);
  const pointC = getPosition(CD, 0);
  const pointD = getPosition(CD, CD.length);

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
      radius: 2 <= index && index < 6 ? curveEditMenuState.curveRadius : -curveEditMenuState.curveRadius,
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
      beginCant: 2 <= index && index < 6 ? curveEditMenuState.cant : -curveEditMenuState.cant,
      endCant: 2 <= index && index < 6 ? curveEditMenuState.cant : -curveEditMenuState.cant,
      gradients: { 0: 0 },
      trackModels: [],
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

  if (featureCollectionsTabPanelState.straightTracks.length) {
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

export function connectTwoStraightLinesWithCurve(AB: Track, ABId: string, CD: Track, CDId: string, curveIndex: number, s: number, t: number, curve: Track, transitionCurveAB?: TransitionCurve, transitionCurveCD?: TransitionCurve, createSwitch = true) {
  const messages: [MessageCode.FROM_CLIENT_SET_PROP, [Path<SerializableSaveDataType>, PathValue<SerializableSaveDataType, Path<SerializableSaveDataType>>, Path<SerializableSaveDataType>?]][] = [];

  const sCurve: SerializableTrack = createSerializableTrackBasedOnTrack(
    curve,
    0,
    1,
    curve.beginCant,
    curve.endCant,
    AB.trackModels,
  );
  const sCurveId = uuidv4();

  const sTransitionCurveAB: SerializableTransitionCurve | undefined = transitionCurveAB && applyTransitionCurveToSerializableTrack(
    createSerializableTrackBasedOnTrack(
      transitionCurveAB,
      0,
      1,
      AB.beginCant,
      curve.beginCant,
      AB.trackModels,
    ),
    transitionCurveAB
  );
  const sTransitionCurveABId = uuidv4();

  const sTransitionCurveCD: SerializableTransitionCurve | undefined = transitionCurveCD && applyTransitionCurveToSerializableTrack(
    createSerializableTrackBasedOnTrack(
      transitionCurveCD,
      0,
      1,
      curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7 ? CD.beginCant : -CD.beginCant,
      -curve.endCant,
      CD.trackModels,
    ),
    transitionCurveCD
  );
  const sTransitionCurveCDId = uuidv4();

  const s_ = s * AB.length;
  const t_ = t * CD.length;

  // ABと接続する
  if (s_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    // ABの始点と接続する場合
    let track0IsChanged = false;

    if (curveIndex < 4) {
      const railroadSwitch: Switch = {
        connectedTrackIds: [ABId, sTransitionCurveAB ? sTransitionCurveABId : sCurveId],
        isConnectedToEnd: [false, false],
        currentConnected: 0,
      };
      // TODO メッセージをまとめて送信する
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["switches", uuidv4()],
        railroadSwitch
      ]]);
    } else {
      connectTwoTracks(AB, ABId, false, sTransitionCurveAB || sCurve, sTransitionCurveAB ? sTransitionCurveABId : sCurveId, false);

      track0IsChanged = true;
    }

    if (s < 0) {
      AB.position = getPosition(AB, AB.length * s);
      AB.length *= 1 - s;

      track0IsChanged = true;
    }

    if (track0IsChanged)
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["tracks", ABId],
        toSerializableSaveData(trackTypeId, AB, gameState.data)
      ]]);
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= s_ - AB.length) {
    // ABの終点と接続する場合
    let track0IsChanged = false;

    if (curveIndex < 4) {
      connectTwoTracks(AB, ABId, true, sTransitionCurveAB || sCurve, sTransitionCurveAB ? sTransitionCurveABId : sCurveId, false);

      track0IsChanged = true;
    } else {
      const railroadSwitch: Switch = {
        connectedTrackIds: [ABId, sTransitionCurveAB ? sTransitionCurveABId : sCurveId],
        isConnectedToEnd: [true, false],
        currentConnected: 0,
      };
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["switches", uuidv4()],
        railroadSwitch
      ]]);
    }

    if (1 < s) {
      AB.length *= s;

      track0IsChanged = true;
    }

    if (track0IsChanged)
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["tracks", ABId],
        toSerializableSaveData(trackTypeId, AB, gameState.data)
      ]]);
  } else {
    // ABの中間と接続する場合

    if (createSwitch) {
      // 分岐器を作成する場合
      const trackBId = uuidv4();
      let trackB: SerializableTrack; // 分岐器の直進側

      const switchId = uuidv4();
      const railroadSwitch: Switch = {
        connectedTrackIds: [],
        isConnectedToEnd: [],
        currentConnected: -1,
      };

      if (curveIndex < 4) {
        trackB = createSerializableTrackBasedOnTrack(
          AB,
          s,
          1,
          AB.beginCant,
          AB.beginCant,
          AB.trackModels,
        );

        AB.length *= s;

        // 直進側を開通する
        railroadSwitch.connectedTrackIds = [trackBId, sTransitionCurveAB ? sTransitionCurveABId : sCurveId];
        railroadSwitch.isConnectedToEnd = [false, false];
        railroadSwitch.currentConnected = 0;

        trackB.idOfTrackOrSwitchConnectedFromEnd = AB.idOfTrackOrSwitchConnectedFromEnd;
        trackB.connectedFromEndIsTrack = AB.connectedFromEndIsTrack;
        trackB.connectedFromEndIsToEnd = AB.connectedFromEndIsToEnd;

        AB.idOfTrackOrSwitchConnectedFromEnd = switchId;
        AB.connectedFromEndIsTrack = false;
        trackB.idOfTrackOrSwitchConnectedFromStart = ABId;
        trackB.connectedFromStartIsTrack = true;
        trackB.connectedFromStartIsToEnd = true;
      } else {
        trackB = createSerializableTrackBasedOnTrack(
          AB,
          0,
          s,
          AB.beginCant,
          AB.beginCant,
          AB.trackModels,
        );

        AB.position = getPosition(AB, AB.length * s);
        AB.length *= (1 - s);

        railroadSwitch.connectedTrackIds = [trackBId, sTransitionCurveAB ? sTransitionCurveABId : sCurveId];
        railroadSwitch.isConnectedToEnd = [true, false];
        railroadSwitch.currentConnected = 0;

        trackB.idOfTrackOrSwitchConnectedFromStart = AB.idOfTrackOrSwitchConnectedFromStart;
        trackB.connectedFromStartIsTrack = AB.connectedFromStartIsTrack;
        trackB.connectedFromStartIsToEnd = AB.connectedFromStartIsToEnd;

        trackB.idOfTrackOrSwitchConnectedFromEnd = ABId;
        trackB.connectedFromEndIsTrack = true;
        trackB.connectedFromEndIsToEnd = false;
        AB.idOfTrackOrSwitchConnectedFromStart = switchId;
        AB.connectedFromStartIsTrack = false;
      }

      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["tracks", trackBId],
        trackB
      ]]);

      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["switches", switchId],
        railroadSwitch
      ]]);
    } else {
      // 分岐器を作成しない場合
      if (curveIndex < 4) {
        AB.length *= s;

        connectTwoTracks(AB, ABId, true, sTransitionCurveAB || sCurve, sTransitionCurveAB ? sTransitionCurveABId : sCurveId, false);
      } else {
        AB.position = getPosition(AB, AB.length * s);
        AB.length *= (1 - s);

        connectTwoTracks(AB, ABId, false, sTransitionCurveAB || sCurve, sTransitionCurveAB ? sTransitionCurveABId : sCurveId, false);
      }
    }

    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", ABId],
      toSerializableSaveData(trackTypeId, AB, gameState.data)
    ]]);
  }

  // CDと接続する
  if (t_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    let track1IsChanged = false;

    if (curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7) {
      const railroadSwitch: Switch = {
        connectedTrackIds: [CDId, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId],
        isConnectedToEnd: [false, false],
        currentConnected: 0,
      };
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["switches", uuidv4()],
        railroadSwitch
      ]]);
    } else {
      connectTwoTracks(sTransitionCurveCD || sCurve, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId, !sTransitionCurveCD, CD, CDId, false);

      track1IsChanged = true;
    }

    if (t < 0) {
      CD.position = getPosition(CD, CD.length * t);
      CD.length *= 1 - t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["tracks", CDId],
        toSerializableSaveData(trackTypeId, CD, gameState.data)
      ]]);
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= t_ - CD.length) {
    let track1IsChanged = false;

    if (curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7) {
      connectTwoTracks(sTransitionCurveCD || sCurve, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId, !sTransitionCurveCD, CD, CDId, true);

      track1IsChanged = true;
    } else {
      const railroadSwitch: Switch = {
        connectedTrackIds: [CDId, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId],
        isConnectedToEnd: [true, sTransitionCurveCD ? false : true],
        currentConnected: 0,
      };
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["switches", uuidv4()],
        railroadSwitch
      ]]);
    }

    if (1 < t) {
      CD.length *= t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["tracks", CDId],
        toSerializableSaveData(trackTypeId, CD, gameState.data)
      ]]);
  } else {
    if (createSwitch) {
      const trackBId = uuidv4();
      let trackB: SerializableTrack;

      const switchId = uuidv4();
      const railroadSwitch: Switch = {
        connectedTrackIds: [],
        isConnectedToEnd: [],
        currentConnected: -1,
      };

      if (curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7) {
        trackB = createSerializableTrackBasedOnTrack(
          CD,
          t,
          1,
          CD.beginCant,
          CD.beginCant,
          CD.trackModels,
        );

        CD.length *= t;

        railroadSwitch.connectedTrackIds = [trackBId, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId];
        railroadSwitch.isConnectedToEnd = [false, sTransitionCurveCD ? false : true];
        railroadSwitch.currentConnected = 0;

        trackB.idOfTrackOrSwitchConnectedFromEnd = CD.idOfTrackOrSwitchConnectedFromEnd;
        trackB.connectedFromEndIsTrack = CD.connectedFromEndIsTrack;
        trackB.connectedFromEndIsToEnd = CD.connectedFromEndIsToEnd;

        CD.idOfTrackOrSwitchConnectedFromEnd = switchId;
        CD.connectedFromEndIsTrack = false;
        trackB.idOfTrackOrSwitchConnectedFromStart = CDId;
        trackB.connectedFromStartIsTrack = true;
        trackB.connectedFromStartIsToEnd = true;
      } else {
        trackB = createSerializableTrackBasedOnTrack(
          CD,
          0,
          t,
          CD.beginCant,
          CD.beginCant,
          CD.trackModels,
        );

        CD.position = getPosition(CD, CD.length * t);
        CD.length *= (1 - t);

        railroadSwitch.connectedTrackIds = [trackBId, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId];
        railroadSwitch.isConnectedToEnd = [true, sTransitionCurveCD ? false : true];
        railroadSwitch.currentConnected = 0;

        trackB.idOfTrackOrSwitchConnectedFromStart = CD.idOfTrackOrSwitchConnectedFromStart;
        trackB.connectedFromStartIsTrack = CD.connectedFromStartIsTrack;
        trackB.connectedFromStartIsToEnd = CD.connectedFromStartIsToEnd;

        CD.idOfTrackOrSwitchConnectedFromStart = switchId;
        CD.connectedFromStartIsTrack = false;
        trackB.idOfTrackOrSwitchConnectedFromEnd = CDId;
        trackB.connectedFromEndIsTrack = true;
        trackB.connectedFromEndIsToEnd = false;
      }

      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["tracks", trackBId],
        trackB
      ]]);

      messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
        ["switches", switchId],
        railroadSwitch
      ]]);
    } else {
      if (curveIndex === 1 || curveIndex === 2 || curveIndex === 4 || curveIndex === 7) {
        CD.length *= t;

        connectTwoTracks(sTransitionCurveCD || sCurve, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId, !sTransitionCurveCD, CD, CDId, true);
      } else {
        CD.position = getPosition(CD, CD.length * t);
        CD.length *= (1 - t);

        connectTwoTracks(sTransitionCurveCD || sCurve, sTransitionCurveCD ? sTransitionCurveCDId : sCurveId, !sTransitionCurveCD, CD, CDId, false);
      }
    }

    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", CDId],
      toSerializableSaveData(trackTypeId, CD, gameState.data)
    ]]);
  }

  // 緩和曲線と単曲線を接続する
  if (sTransitionCurveAB)
    connectTwoTracks(sTransitionCurveAB, sTransitionCurveABId, true, sCurve, sCurveId, false);
  if (sTransitionCurveCD)
    connectTwoTracks(sCurve, sCurveId, true, sTransitionCurveCD, sTransitionCurveCDId, true);

  messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
    ["tracks", sCurveId],
    sCurve
  ]]);
  if (sTransitionCurveAB)
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", sTransitionCurveABId],
      sTransitionCurveAB
    ]]);
  if (sTransitionCurveCD)
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", sTransitionCurveCDId],
      sTransitionCurveCD
    ]]);

  send(socket, MessageCode.FROM_CLIENT_MESSAGES, messages);

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
        label="Cant"
        defaultValue={curveEditMenuState.cant}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const cant = parseFloat(event.target.value);
          if (Number.isNaN(cant)) return;

          curveEditMenuState.cant = cant;
          updateAddingTracks();
        }}
      />
    </>
  );
}
