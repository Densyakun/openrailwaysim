import * as React from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { proxy, useSnapshot } from 'valtio';
import { Button, Paper, Stack, TextField } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { coordinateToEuler, getRelativePosition } from '@/lib/gis';
import { gameState } from '@/lib/client';
import centroid from '@turf/centroid';
import { SerializableSwitch, SerializableTrack, SerializableTransitionCurve, TOLERANCE_FOR_TRACK_CONNECTIONS, Track, TransitionCurve, TransitionCurveData, getPosition, getSelectedTracks, getTransitionCurveData, state as tracksState } from '@/lib/tracks';
import { guiState } from './GUI';
import { lineString } from '@turf/helpers';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game';

export const tracksSubMenuState = proxy<{
  isAddingCurve: boolean;
  addingCurves: (Track | undefined)[]; // 単曲線
  addingTransitions: (TransitionCurve | undefined)[]; // AB側の緩和曲線
  addingTransitions1: (TransitionCurve | undefined)[]; // CD側の緩和曲線
  S: number[]; // ベクトルABの係数
  T: number[]; // ベクトルCDの係数
  ABLength: number;
  CDLength: number;
  curveRadius: number;
  transitionLength: number;
  transitionLength1: number;
  hoveredAddingTracks: number;
}>({
  isAddingCurve: false,
  addingCurves: [],
  addingTransitions: [],
  addingTransitions1: [],
  S: [],
  T: [],
  ABLength: 0,
  CDLength: 0,
  curveRadius: 400,
  transitionLength: 60,
  transitionLength1: 60,
  hoveredAddingTracks: -1,
});

function updateAddingTracks() {
  const tracks = getSelectedTracks(gameState);

  const centerCoordinate = centroid(lineString(tracks.map(track => track.centerCoordinate))).geometry.coordinates;
  const centerCoordinateEuler = coordinateToEuler(centerCoordinate);

  const trackCenterCoordinates = tracks.map(track => getRelativePosition(track.centerCoordinate, centerCoordinateEuler, centerCoordinate, 0));

  const pointA = trackCenterCoordinates[0].clone().add(tracks[0].position);
  const pointB = trackCenterCoordinates[0].clone().add(getPosition(tracks[0].position, tracks[0].rotationY, tracks[0].length, 0));
  const pointC = trackCenterCoordinates[1].clone().add(tracks[1].position);
  const pointD = trackCenterCoordinates[1].clone().add(getPosition(tracks[1].position, tracks[1].rotationY, tracks[1].length, 0));

  const AB = pointB.clone().sub(pointA);
  const CD = pointD.clone().sub(pointC);
  const rotationYAB = Math.atan2(-AB.z, AB.x);
  const rotationYCD = Math.atan2(-CD.z, CD.x);

  // 単曲線を作成する
  let ABOffset = tracksSubMenuState.curveRadius;
  let CDOffset = tracksSubMenuState.curveRadius;

  let curveRad = rotationYCD - rotationYAB;
  curveRad -= Math.floor((curveRad + Math.PI) / (Math.PI * 2)) * Math.PI * 2; // 値の範囲を -Math.PI <= rad < Math.PI にする

  let transitionRad = 0;
  let transitionRadAB = 0;

  let transitionCurve: TransitionCurveData = undefined!;
  if (tracksSubMenuState.transitionLength !== 0) {
    transitionCurve = getTransitionCurveData(0, 1 / tracksSubMenuState.curveRadius, tracksSubMenuState.transitionLength);

    ABOffset = tracksSubMenuState.curveRadius * Math.cos(transitionCurve.endRotationY) - transitionCurve.endPosition.z;

    transitionRad += transitionCurve.endRotationY;
    transitionRadAB += transitionCurve.endRotationY;
  }

  let transitionCurve1: TransitionCurveData;
  if (tracksSubMenuState.transitionLength1 !== 0) {
    transitionCurve1 = getTransitionCurveData(0, 1 / tracksSubMenuState.curveRadius, tracksSubMenuState.transitionLength1);

    CDOffset = tracksSubMenuState.curveRadius * Math.cos(transitionCurve1.endRotationY) - transitionCurve1.endPosition.z;

    transitionRad += transitionCurve1.endRotationY;
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

  const ABOffsetVector1 = new THREE.Vector3(0, 0, tracksSubMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYAB + transitionRadAB));
  const ABOffsetVector2 = new THREE.Vector3(0, 0, tracksSubMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYAB - transitionRadAB));

  const curves = 0 <= curveRad
    ? [
      {
        position: circleCenterLL.clone().add(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterLL.clone().add(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
    ]
    : [
      {
        position: circleCenterLL.clone().add(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (-curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB,
      },
      {
        position: circleCenterLL.clone().add(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (-curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterLR.clone().add(ABOffsetVector2),
        length: tracksSubMenuState.curveRadius * (Math.PI - curveRad - transitionRad),
        rotationY: rotationYAB - transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRL.clone().sub(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (Math.PI + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
      {
        position: circleCenterRR.clone().sub(ABOffsetVector1),
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 + curveRad - transitionRad),
        rotationY: rotationYAB + transitionRadAB - Math.PI,
      },
    ];

  tracksSubMenuState.addingCurves = curves.map((curve, index) => {
    if (curve.length <= 0) return;

    return {
      ...curve,
      centerCoordinate,
      radius: 2 <= index && index < 6 ? tracksSubMenuState.curveRadius : -tracksSubMenuState.curveRadius,
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
    };
  });

  tracksSubMenuState.ABLength = AB.length();

  // 緩和曲線を作成する
  if (tracksSubMenuState.transitionLength === 0) {
    // AB側に緩和曲線がない場合、直線の接合点を曲線の始点にする
    tracksSubMenuState.S = [
      curveSLL,
      curveSLR,
      curveSRL,
      curveSRR,
      curveSLL,
      curveSLR,
      curveSRL,
      curveSRR,
    ];

    tracksSubMenuState.addingTransitions = tracksSubMenuState.addingCurves.map(() => undefined);
  } else {
    // AB側に緩和曲線がある場合、直線の接合点を緩和曲線の始点にする
    tracksSubMenuState.S = tracksSubMenuState.addingCurves.map((curve, index) =>
      curve ?
        index < 4 ? curve.position.clone()
          .sub(pointA).applyEuler(new THREE.Euler(0, -rotationYAB))
          .sub(transitionCurve.endPosition).x / tracksSubMenuState.ABLength
          : curve.position.clone()
            .sub(pointA).applyEuler(new THREE.Euler(0, -rotationYAB))
            .add(transitionCurve.endPosition).x / tracksSubMenuState.ABLength
        : 0
    );

    tracksSubMenuState.addingTransitions = tracksSubMenuState.addingCurves.map((curve, index) => {
      if (!curve) return;

      return {
        ...curve,
        ...transitionCurve,
        position: pointA.clone().add(AB.clone().multiplyScalar(tracksSubMenuState.S[index])),
        rotationY: 0 <= index && index < 4 ? rotationYAB : rotationYAB - Math.PI,
        length: tracksSubMenuState.transitionLength,
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

  tracksSubMenuState.CDLength = CD.length();

  if (tracksSubMenuState.transitionLength1 === 0) {
    // CD側に緩和曲線がない場合、直線の接合点を曲線の終点にする
    tracksSubMenuState.T = [
      curveTLL,
      curveTLR,
      curveTRL,
      curveTRR,
      curveTLL,
      curveTLR,
      curveTRL,
      curveTRR,
    ];

    tracksSubMenuState.addingTransitions1 = tracksSubMenuState.addingCurves.map(() => undefined);
  } else {
    // CD側に緩和曲線がある場合、直線の接合点を緩和曲線の始点にする
    tracksSubMenuState.T = tracksSubMenuState.addingCurves.map((curve, index) => {
      if (!curve) return 0;
      const curveEndPos = getPosition(curve.position, curve.rotationY, curve.length, curve.radius);
      return index === 1 || index === 2 || index === 4 || index === 7 ? curveEndPos
        .sub(pointC).applyEuler(new THREE.Euler(0, -rotationYCD))
        .sub(transitionCurve1.endPosition)
        .x / tracksSubMenuState.CDLength
        : curveEndPos
          .sub(pointC).applyEuler(new THREE.Euler(0, -rotationYCD))
          .add(transitionCurve1.endPosition).x / tracksSubMenuState.CDLength;
    });

    tracksSubMenuState.addingTransitions1 = tracksSubMenuState.addingCurves.map((curve, index) => {
      if (!curve) return;

      return {
        ...curve,
        ...transitionCurve1,
        position: pointC.clone().add(CD.clone().multiplyScalar(tracksSubMenuState.T[index])),
        rotationY: index === 1 || index === 2 || index === 4 || index === 7 ? rotationYCD : rotationYCD - Math.PI,
        length: tracksSubMenuState.transitionLength1,
        curveDirection: 2 <= index && index < 6 ? true : false,
      };
    });
  }
}

export function onClickAddingTrack(index: number) {
  if (!tracksSubMenuState.addingCurves[index]) return;

  const tracks = getSelectedTracks(gameState);

  const curveId = uuidv4();

  const curve = tracksSubMenuState.addingCurves[index] as Track;

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
  }

  const transitionCurveId = uuidv4();

  const transitionCurve = tracksSubMenuState.addingTransitions[index] as TransitionCurve;

  const serializableTransitionCurve: SerializableTransitionCurve = transitionCurve && {
    id: transitionCurveId,
    centerCoordinate: transitionCurve.centerCoordinate,
    position: transitionCurve.position.toArray(),
    rotationY: transitionCurve.rotationY,
    length: transitionCurve.length,
    radius: transitionCurve.radius,
    /*startGrade: 0, // TODO grade
    endGrade: 0,*/
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCurvature: transitionCurve.beginCurvature,
    endCurvature: transitionCurve.endCurvature,
    endPosition: transitionCurve.endPosition.toArray(),
    endRotationY: transitionCurve.endRotationY,
    transitionCurves: transitionCurve.transitionCurves.map(value => ({
      position: value.position.toArray(),
      rotationY: value.rotationY,
      curvature: value.curvature,
    })),
    curveDirection: transitionCurve.curveDirection,
  };

  const transitionCurve1Id = uuidv4();

  const transitionCurve1 = tracksSubMenuState.addingTransitions1[index] as TransitionCurve;

  const serializableTransitionCurve1: SerializableTransitionCurve = transitionCurve1 && {
    id: transitionCurve1Id,
    centerCoordinate: transitionCurve1.centerCoordinate,
    position: transitionCurve1.position.toArray(),
    rotationY: transitionCurve1.rotationY,
    length: transitionCurve1.length,
    radius: transitionCurve1.radius,
    /*startGrade: 0, // TODO grade
    endGrade: 0,*/
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
    beginCurvature: transitionCurve1.beginCurvature,
    endCurvature: transitionCurve1.endCurvature,
    endPosition: transitionCurve1.endPosition.toArray(),
    endRotationY: transitionCurve1.endRotationY,
    transitionCurves: transitionCurve1.transitionCurves.map(value => ({
      position: value.position.toArray(),
      rotationY: value.rotationY,
      curvature: value.curvature,
    })),
    curveDirection: transitionCurve1.curveDirection,
  };

  // TODO すでに分岐器が存在する場合、軌道を追加で接続する
  const s = tracksSubMenuState.S[index];
  const t = tracksSubMenuState.T[index];
  const s_ = s * tracksSubMenuState.ABLength;
  const t_ = t * tracksSubMenuState.CDLength;
  if (s_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    let track0IsChanged = false;

    if (index < 4) {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTrackIds[0], serializableTransitionCurve ? transitionCurveId : curveId],
          isConnectedToEnd: [false, false],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    } else {
      tracks[0].idOfTrackOrSwitchConnectedFromStart = serializableTransitionCurve ? transitionCurveId : curveId;
      tracks[0].connectedFromStartIsTrack = true;
      tracks[0].connectedFromStartIsToEnd = false;
      const connectedTrack = serializableTransitionCurve || serializableCurve;
      connectedTrack.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTrackIds[0];
      connectedTrack.connectedFromStartIsTrack = true;
      connectedTrack.connectedFromStartIsToEnd = false;

      track0IsChanged = true;
    }

    if (s < 0) {
      tracks[0].position = getPosition(tracks[0].position, tracks[0].rotationY, tracks[0].length * s, 0);
      tracks[0].length *= 1 - s;

      track0IsChanged = true;
    }

    if (track0IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", tracksState.selectedTrackIds[0]], tracks[0])
      ]]));
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= s_ - tracksSubMenuState.ABLength) {
    let track0IsChanged = false;

    if (index < 4) {
      tracks[0].idOfTrackOrSwitchConnectedFromEnd = serializableTransitionCurve ? transitionCurveId : curveId;
      tracks[0].connectedFromEndIsTrack = true;
      tracks[0].connectedFromEndIsToEnd = false;
      const connectedTrack = serializableTransitionCurve || serializableCurve;
      connectedTrack.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTrackIds[0];
      connectedTrack.connectedFromStartIsTrack = true;
      connectedTrack.connectedFromStartIsToEnd = true;

      track0IsChanged = true;
    } else {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTrackIds[0], serializableTransitionCurve ? transitionCurveId : curveId],
          isConnectedToEnd: [true, false],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    }

    if (1 < s) {
      tracks[0].length *= s;

      track0IsChanged = true;
    }

    if (track0IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", tracksState.selectedTrackIds[0]], tracks[0])
      ]]));
  } else {
    const trackB: SerializableTrack = {
      id: uuidv4(),
      centerCoordinate: tracks[0].centerCoordinate,
      position: getPosition(tracks[0].position, tracks[0].rotationY, tracks[0].length * s, 0).toArray(),
      rotationY: tracks[0].rotationY,
      length: tracks[0].length * (1 - s),
      radius: 0,
      /*startGrade: 0, // TODO grade
      endGrade: 0,*/
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
    }

    const railroadSwitch: SerializableSwitch = {
      id: uuidv4(),
      connectedTrackIds: [],
      isConnectedToEnd: [],
      currentConnected: -1,
    };

    if (index < 4) {
      railroadSwitch.connectedTrackIds = [trackB.id, serializableTransitionCurve ? transitionCurveId : curveId];
      railroadSwitch.isConnectedToEnd = [false, false];
      railroadSwitch.currentConnected = 0;

      tracks[0].idOfTrackOrSwitchConnectedFromEnd = railroadSwitch.id;
      tracks[0].connectedFromEndIsTrack = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTrackIds[0];
      trackB.connectedFromStartIsTrack = true;
      trackB.connectedFromStartIsToEnd = true;
    } else {
      railroadSwitch.connectedTrackIds = [tracksState.selectedTrackIds[0], serializableTransitionCurve ? transitionCurveId : curveId];
      railroadSwitch.isConnectedToEnd = [true, false];
      railroadSwitch.currentConnected = 0;

      tracks[0].idOfTrackOrSwitchConnectedFromEnd = trackB.id;
      tracks[0].connectedFromEndIsTrack = true;
      tracks[0].connectedFromEndIsToEnd = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = railroadSwitch.id;
      trackB.connectedFromStartIsTrack = false;
    }

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", trackB]]));

    tracks[0].length *= s;

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
      "tracks",
      toSerializableProp(["tracks", tracksState.selectedTrackIds[0]], tracks[0])
    ]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["switches", railroadSwitch]]));
  }

  if (t_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    let track1IsChanged = false;

    if (index === 1 || index === 2 || index === 4 || index === 7) {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTrackIds[1], serializableTransitionCurve1 ? transitionCurve1Id : curveId],
          isConnectedToEnd: [false, serializableTransitionCurve1 ? false : true],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    } else {
      tracks[1].idOfTrackOrSwitchConnectedFromStart = serializableTransitionCurve1 ? transitionCurve1Id : curveId;
      tracks[1].connectedFromStartIsTrack = true;
      tracks[1].connectedFromStartIsToEnd = serializableTransitionCurve1 ? false : true;
      const connectedTrack = serializableTransitionCurve1 || serializableCurve;
      if (serializableTransitionCurve1) {
        connectedTrack.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTrackIds[1];
        connectedTrack.connectedFromStartIsTrack = true;
        connectedTrack.connectedFromStartIsToEnd = false;
      } else {
        connectedTrack.idOfTrackOrSwitchConnectedFromEnd = tracksState.selectedTrackIds[1];
        connectedTrack.connectedFromEndIsTrack = true;
        connectedTrack.connectedFromEndIsToEnd = false;
      }

      track1IsChanged = true;
    }

    if (t < 0) {
      tracks[1].position = getPosition(tracks[1].position, tracks[1].rotationY, tracks[1].length * t, 0);
      tracks[1].length *= 1 - t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", tracksState.selectedTrackIds[1]], tracks[1])
      ]]));
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= t_ - tracksSubMenuState.CDLength) {
    let track1IsChanged = false;

    if (index === 1 || index === 2 || index === 4 || index === 7) {
      tracks[1].idOfTrackOrSwitchConnectedFromEnd = serializableTransitionCurve1 ? transitionCurve1Id : curveId;
      tracks[1].connectedFromEndIsTrack = true;
      tracks[1].connectedFromEndIsToEnd = serializableTransitionCurve1 ? false : true;
      const connectedTrack = serializableTransitionCurve1 || serializableCurve;
      if (serializableTransitionCurve1) {
        connectedTrack.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTrackIds[1];
        connectedTrack.connectedFromStartIsTrack = true;
        connectedTrack.connectedFromStartIsToEnd = true;
      } else {
        connectedTrack.idOfTrackOrSwitchConnectedFromEnd = tracksState.selectedTrackIds[1];
        connectedTrack.connectedFromEndIsTrack = true;
        connectedTrack.connectedFromEndIsToEnd = true;
      }

      track1IsChanged = true;
    } else {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTrackIds[1], serializableTransitionCurve1 ? transitionCurve1Id : curveId],
          isConnectedToEnd: [true, serializableTransitionCurve1 ? false : true],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    }

    if (1 < t) {
      tracks[1].length *= t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", tracksState.selectedTrackIds[1]], tracks[1])
      ]]));
  } else {
    const trackB: SerializableTrack = {
      id: uuidv4(),
      centerCoordinate: tracks[1].centerCoordinate,
      position: getPosition(tracks[1].position, tracks[1].rotationY, tracks[1].length * t, 0).toArray(),
      rotationY: tracks[1].rotationY,
      length: tracks[1].length * (1 - t),
      radius: 0,
      /*startGrade: 0, // TODO grade
      endGrade: 0,*/
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
    }

    const railroadSwitch: SerializableSwitch = {
      id: uuidv4(),
      connectedTrackIds: [],
      isConnectedToEnd: [],
      currentConnected: -1,
    };

    if (index === 1 || index === 2 || index === 4 || index === 7) {
      railroadSwitch.connectedTrackIds = [trackB.id, serializableTransitionCurve1 ? transitionCurve1Id : curveId];
      railroadSwitch.isConnectedToEnd = [false, serializableTransitionCurve1 ? false : true];
      railroadSwitch.currentConnected = 0;

      tracks[1].idOfTrackOrSwitchConnectedFromEnd = railroadSwitch.id;
      tracks[1].connectedFromEndIsTrack = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTrackIds[1];
      trackB.connectedFromStartIsTrack = true;
      trackB.connectedFromStartIsToEnd = true;
    } else {
      railroadSwitch.connectedTrackIds = [tracksState.selectedTrackIds[1], serializableTransitionCurve1 ? transitionCurve1Id : curveId];
      railroadSwitch.isConnectedToEnd = [true, serializableTransitionCurve1 ? false : true];
      railroadSwitch.currentConnected = 0;

      tracks[1].idOfTrackOrSwitchConnectedFromEnd = trackB.id;
      tracks[1].connectedFromEndIsTrack = true;
      tracks[1].connectedFromEndIsToEnd = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = railroadSwitch.id;
      trackB.connectedFromStartIsTrack = false;
    }

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", trackB]]));

    tracks[1].length *= t;

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
      "tracks",
      toSerializableProp(["tracks", tracksState.selectedTrackIds[1]], tracks[1])
    ]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["switches", railroadSwitch]]));
  }

  if (serializableTransitionCurve) {
    serializableTransitionCurve.idOfTrackOrSwitchConnectedFromEnd = curveId;
    serializableTransitionCurve.connectedFromEndIsTrack = true;
    serializableTransitionCurve.connectedFromEndIsToEnd = false;
    serializableCurve.idOfTrackOrSwitchConnectedFromStart = transitionCurveId;
    serializableCurve.connectedFromStartIsTrack = true;
    serializableCurve.connectedFromStartIsToEnd = true;
  }
  if (serializableTransitionCurve1) {
    serializableTransitionCurve1.idOfTrackOrSwitchConnectedFromEnd = curveId;
    serializableTransitionCurve1.connectedFromEndIsTrack = true;
    serializableTransitionCurve1.connectedFromEndIsToEnd = true;
    serializableCurve.idOfTrackOrSwitchConnectedFromEnd = transitionCurve1Id;
    serializableCurve.connectedFromEndIsTrack = true;
    serializableCurve.connectedFromEndIsToEnd = true;
  }

  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", serializableCurve]]));
  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", serializableTransitionCurve]]));
  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", serializableTransitionCurve1]]));

  updateAddingTracks();
}

export default function TracksSubMenu() {
  useSnapshot(guiState);
  useSnapshot(tracksState);
  useSnapshot(tracksSubMenuState);

  return (
    <>
      <Paper sx={{ p: 1 }}>
        <Stack direction={'column'} spacing={1}>
          {tracksSubMenuState.isAddingCurve ? <>
            <Button variant='outlined' onClick={() => {
              tracksSubMenuState.isAddingCurve = false;
              tracksSubMenuState.addingCurves.splice(0);
            }}>
              <ArrowBackIcon />
            </Button>
            <TextField
              label="Radius"
              defaultValue={tracksSubMenuState.curveRadius}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const radius = parseFloat(event.target.value);
                if (Number.isNaN(radius) || radius === 0) return;

                tracksSubMenuState.curveRadius = Math.max(-radius, radius);
                updateAddingTracks();
              }}
            />
            <TextField
              label="Transition length 1"
              defaultValue={tracksSubMenuState.transitionLength}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const length = parseFloat(event.target.value);
                if (Number.isNaN(length)) return;

                tracksSubMenuState.transitionLength = Math.max(0, length);
                updateAddingTracks();
              }}
            />
            <TextField
              label="Transition length 2"
              defaultValue={tracksSubMenuState.transitionLength1}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const length = parseFloat(event.target.value);
                if (Number.isNaN(length)) return;

                tracksSubMenuState.transitionLength1 = Math.max(0, length);
                updateAddingTracks();
              }}
            />
          </>
            : <>
              <Button variant='contained' disabled={!tracksState.selectedTrackIds.length} onClick={() => {
                tracksState.selectedTrackIds.splice(0, tracksState.selectedTrackIds.length);
              }}>
                Deselect tracks
              </Button>
              <Button variant='contained' disabled={tracksState.selectedTrackIds.length !== 2} onClick={() => {
                const tracks = getSelectedTracks(gameState);

                const centerCoordinate = centroid(lineString(tracks.map(track => track.centerCoordinate))).geometry.coordinates;
                const centerCoordinateEuler = coordinateToEuler(centerCoordinate);

                const trackCenterCoordinates = tracks.map(track => getRelativePosition(track.centerCoordinate, centerCoordinateEuler, centerCoordinate, 0));

                const pointA = trackCenterCoordinates[0].clone().add(tracks[0].position);
                const pointB = trackCenterCoordinates[0].clone().add(tracks[0].position.clone().add(new THREE.Vector3(1).applyEuler(new THREE.Euler(0, tracks[0].rotationY)).multiplyScalar(tracks[0].length)));
                const pointC = trackCenterCoordinates[1].clone().add(tracks[1].position);
                const pointD = trackCenterCoordinates[1].clone().add(tracks[1].position.clone().add(new THREE.Vector3(1).applyEuler(new THREE.Euler(0, tracks[1].rotationY)).multiplyScalar(tracks[1].length)));

                const s = ((pointC.x - pointA.x) * (pointD.z - pointC.z) - (pointC.z - pointA.z) * (pointD.x - pointC.x))
                  / ((pointB.x - pointA.x) * (pointD.z - pointC.z) - (pointB.z - pointA.z) * (pointD.x - pointC.x));

                // 平行の場合
                if (Number.isNaN(s)) return;

                tracksSubMenuState.isAddingCurve = true;
                updateAddingTracks();
              }}>
                Create new curve
              </Button>
            </>}
        </Stack>
      </Paper>
    </>
  );
}