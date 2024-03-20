import * as React from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { proxy, useSnapshot } from 'valtio';
import { Button, Paper, Stack, TextField } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { coordinateToEuler, getRelativePosition } from '@/lib/gis';
import { gameState } from '@/lib/client';
import centroid from '@turf/centroid';
import { SerializableSwitch, SerializableTrack, TOLERANCE_FOR_TRACK_CONNECTIONS, Track, getPosition, state as tracksState } from '@/lib/tracks';
import { guiState } from './GUI';
import { lineString } from '@turf/helpers';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game';

export const tracksSubMenuState = proxy<{
  isAddingCurve: boolean;
  addingTracks: Track[];
  curveRadius: number;
  hoveredAddingTracks: number;
}>({
  isAddingCurve: false,
  addingTracks: [],
  curveRadius: 300,
  hoveredAddingTracks: -1,
});

function updateAddingTracks() {
  let tracks: Track[] = [];

  tracksState.selectedTracks
    .forEach(trackId => {
      tracks.push(gameState.tracks[trackId]);
    });

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
  const ABOffsetVector = new THREE.Vector3(0, 0, tracksSubMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYAB));
  const CDOffsetVector = new THREE.Vector3(0, 0, tracksSubMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYCD));

  const pointOffsetAL = pointA.clone().sub(ABOffsetVector);
  const pointOffsetBL = pointB.clone().sub(ABOffsetVector);
  const pointOffsetCL = pointC.clone().sub(CDOffsetVector);
  const pointOffsetDL = pointD.clone().sub(CDOffsetVector);
  const pointOffsetAR = pointA.clone().add(ABOffsetVector);
  const pointOffsetBR = pointB.clone().add(ABOffsetVector);
  const pointOffsetCR = pointC.clone().add(CDOffsetVector);
  const pointOffsetDR = pointD.clone().add(CDOffsetVector);

  const SLL = ((pointOffsetCL.x - pointOffsetAL.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetCL.z - pointOffsetAL.z) * (pointOffsetDL.x - pointOffsetCL.x))
    / ((pointOffsetBL.x - pointOffsetAL.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetBL.z - pointOffsetAL.z) * (pointOffsetDL.x - pointOffsetCL.x));
  const SLR = ((pointOffsetCR.x - pointOffsetAL.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetCR.z - pointOffsetAL.z) * (pointOffsetDR.x - pointOffsetCR.x))
    / ((pointOffsetBL.x - pointOffsetAL.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetBL.z - pointOffsetAL.z) * (pointOffsetDR.x - pointOffsetCR.x));
  const SRL = ((pointOffsetCL.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetCL.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x));
  const SRR = ((pointOffsetCR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetCR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x));

  const circleCenterLL = pointOffsetAL.clone().add(pointOffsetBL.clone().sub(pointOffsetAL).multiplyScalar(SLL));
  const circleCenterLR = pointOffsetAL.clone().add(pointOffsetBL.clone().sub(pointOffsetAL).multiplyScalar(SLR));
  const circleCenterRL = pointOffsetAR.clone().add(pointOffsetBR.clone().sub(pointOffsetAR).multiplyScalar(SRL));
  const circleCenterRR = pointOffsetAR.clone().add(pointOffsetBR.clone().sub(pointOffsetAR).multiplyScalar(SRR));

  let rad = rotationYCD - rotationYAB;
  rad -= Math.floor((rad + Math.PI) / (Math.PI * 2)) * Math.PI * 2;

  // TODO grade

  tracksSubMenuState.addingTracks = 0 <= rad
    ? [
      {
        centerCoordinate,
        position: circleCenterLL.clone().add(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * rad,
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 - rad),
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterLL.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 - rad),
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * rad,
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
    ]
    : [
      {
        centerCoordinate,
        position: circleCenterLL.clone().add(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 + rad),
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * -rad,
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterLL.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * -rad,
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 + rad),
        radius: -tracksSubMenuState.curveRadius,
        idOfTrackOrSwitchConnectedFromStart: "",
        idOfTrackOrSwitchConnectedFromEnd: "",
        connectedFromStartIsTrack: true,
        connectedFromEndIsTrack: true,
        connectedFromStartIsToEnd: false,
        connectedFromEndIsToEnd: false,
      },
    ];
}

export function onClickAddingTrack(index: number) {
  let tracks: Track[] = [];

  tracksState.selectedTracks
    .forEach(trackId => {
      tracks.push(gameState.tracks[trackId]);
    });

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
  const ABOffsetVector = new THREE.Vector3(0, 0, tracksSubMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYAB));
  const CDOffsetVector = new THREE.Vector3(0, 0, tracksSubMenuState.curveRadius).applyEuler(new THREE.Euler(0, rotationYCD));

  const pointOffsetAL = pointA.clone().sub(ABOffsetVector);
  const pointOffsetBL = pointB.clone().sub(ABOffsetVector);
  const pointOffsetCL = pointC.clone().sub(CDOffsetVector);
  const pointOffsetDL = pointD.clone().sub(CDOffsetVector);
  const pointOffsetAR = pointA.clone().add(ABOffsetVector);
  const pointOffsetBR = pointB.clone().add(ABOffsetVector);
  const pointOffsetCR = pointC.clone().add(CDOffsetVector);
  const pointOffsetDR = pointD.clone().add(CDOffsetVector);

  const SLL = ((pointOffsetCL.x - pointOffsetAL.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetCL.z - pointOffsetAL.z) * (pointOffsetDL.x - pointOffsetCL.x))
    / ((pointOffsetBL.x - pointOffsetAL.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetBL.z - pointOffsetAL.z) * (pointOffsetDL.x - pointOffsetCL.x));
  const SLR = ((pointOffsetCR.x - pointOffsetAL.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetCR.z - pointOffsetAL.z) * (pointOffsetDR.x - pointOffsetCR.x))
    / ((pointOffsetBL.x - pointOffsetAL.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetBL.z - pointOffsetAL.z) * (pointOffsetDR.x - pointOffsetCR.x));
  const SRL = ((pointOffsetCL.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetCL.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x));
  const SRR = ((pointOffsetCR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetCR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x));

  const s = index % 4 === 0 ? SLL :
    index % 4 === 1 ? SLR :
      index % 4 === 2 ? SRL :
        SRR;

  const TLL = ((pointOffsetAL.x - pointOffsetCL.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetAL.z - pointOffsetCL.z) * (pointOffsetBL.x - pointOffsetAL.x))
    / ((pointOffsetDL.x - pointOffsetCL.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetDL.z - pointOffsetCL.z) * (pointOffsetBL.x - pointOffsetAL.x));
  const TLR = ((pointOffsetAL.x - pointOffsetCR.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetAL.z - pointOffsetCR.z) * (pointOffsetBL.x - pointOffsetAL.x))
    / ((pointOffsetDR.x - pointOffsetCR.x) * (pointOffsetBL.z - pointOffsetAL.z) - (pointOffsetDR.z - pointOffsetCR.z) * (pointOffsetBL.x - pointOffsetAL.x));
  const TRL = ((pointOffsetAR.x - pointOffsetCL.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetAR.z - pointOffsetCL.z) * (pointOffsetBR.x - pointOffsetAR.x))
    / ((pointOffsetDL.x - pointOffsetCL.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetDL.z - pointOffsetCL.z) * (pointOffsetBR.x - pointOffsetAR.x));
  const TRR = ((pointOffsetAR.x - pointOffsetCR.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetAR.z - pointOffsetCR.z) * (pointOffsetBR.x - pointOffsetAR.x))
    / ((pointOffsetDR.x - pointOffsetCR.x) * (pointOffsetBR.z - pointOffsetAR.z) - (pointOffsetDR.z - pointOffsetCR.z) * (pointOffsetBR.x - pointOffsetAR.x));

  const t = index % 4 === 0 ? TLL :
    index % 4 === 1 ? TLR :
      index % 4 === 2 ? TRL :
        TRR;

  const curveId = uuidv4();

  const curveTrack: SerializableTrack = {
    id: curveId,
    centerCoordinate,
    position: tracksSubMenuState.addingTracks[index].position.toArray(),
    rotationY: tracksSubMenuState.addingTracks[index].rotationY,
    length: tracksSubMenuState.addingTracks[index].length,
    radius: tracksSubMenuState.addingTracks[index].radius,
    /*startGrade: 0, // TODO grade
    endGrade: 0,*/
    idOfTrackOrSwitchConnectedFromStart: "",
    idOfTrackOrSwitchConnectedFromEnd: "",
    connectedFromStartIsTrack: true,
    connectedFromEndIsTrack: true,
    connectedFromStartIsToEnd: false,
    connectedFromEndIsToEnd: false,
  }

  // TODO すでに分岐器が存在する場合、軌道を追加で接続する
  const s_ = s * AB.length();
  const t_ = t * CD.length();
  if (s_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    let track0IsChanged = false;

    if (index < 4) {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTracks[0], curveId],
          isConnectedToEnd: [false, false],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    } else {
      tracks[0].idOfTrackOrSwitchConnectedFromStart = curveId;
      tracks[0].connectedFromStartIsTrack = true;
      tracks[0].connectedFromStartIsToEnd = false;
      curveTrack.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTracks[0];
      curveTrack.connectedFromStartIsTrack = true;
      curveTrack.connectedFromStartIsToEnd = false;

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
        toSerializableProp(["tracks", tracksState.selectedTracks[0]], tracks[0])
      ]]));
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= s_ - AB.length()) {
    let track0IsChanged = false;

    if (index < 4) {
      tracks[0].idOfTrackOrSwitchConnectedFromEnd = curveId;
      tracks[0].connectedFromEndIsTrack = true;
      tracks[0].connectedFromEndIsToEnd = false;
      curveTrack.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTracks[0];
      curveTrack.connectedFromStartIsTrack = true;
      curveTrack.connectedFromStartIsToEnd = true;

      track0IsChanged = true;
    } else {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTracks[0], curveId],
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
        toSerializableProp(["tracks", tracksState.selectedTracks[0]], tracks[0])
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
      railroadSwitch.connectedTrackIds = [trackB.id, curveId];
      railroadSwitch.isConnectedToEnd = [false, false];
      railroadSwitch.currentConnected = 0;

      tracks[0].idOfTrackOrSwitchConnectedFromEnd = railroadSwitch.id;
      tracks[0].connectedFromEndIsTrack = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTracks[0];
      trackB.connectedFromStartIsTrack = true;
      trackB.connectedFromStartIsToEnd = true;
    } else {
      railroadSwitch.connectedTrackIds = [tracksState.selectedTracks[0], curveId];
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
      toSerializableProp(["tracks", tracksState.selectedTracks[0]], tracks[0])
    ]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["switches", railroadSwitch]]));
  }

  if (t_ <= TOLERANCE_FOR_TRACK_CONNECTIONS) {
    let track1IsChanged = false;

    if (index === 0 || index === 3 || index === 4 || index === 7) {
      tracks[1].idOfTrackOrSwitchConnectedFromStart = curveId;
      tracks[1].connectedFromStartIsTrack = true;
      tracks[1].connectedFromStartIsToEnd = true;
      curveTrack.idOfTrackOrSwitchConnectedFromEnd = tracksState.selectedTracks[1];
      curveTrack.connectedFromEndIsTrack = true;
      curveTrack.connectedFromEndIsToEnd = false;

      track1IsChanged = true;
    } else {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTracks[1], curveId],
          isConnectedToEnd: [false, true],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    }

    if (t < 0) {
      tracks[1].position = getPosition(tracks[1].position, tracks[1].rotationY, tracks[1].length * t, 0);
      tracks[1].length *= 1 - t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", tracksState.selectedTracks[1]], tracks[1])
      ]]));
  } else if (-TOLERANCE_FOR_TRACK_CONNECTIONS <= t_ - CD.length()) {
    let track1IsChanged = false;

    if (index === 0 || index === 3 || index === 4 || index === 7) {
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "switches",
        {
          id: uuidv4(),
          connectedTrackIds: [tracksState.selectedTracks[1], curveId],
          isConnectedToEnd: [true, true],
          currentConnected: 0,
        } as SerializableSwitch
      ]]));
    } else {
      tracks[1].idOfTrackOrSwitchConnectedFromEnd = curveId;
      tracks[1].connectedFromEndIsTrack = true;
      tracks[1].connectedFromEndIsToEnd = true;
      curveTrack.idOfTrackOrSwitchConnectedFromEnd = tracksState.selectedTracks[1];
      curveTrack.connectedFromEndIsTrack = true;
      curveTrack.connectedFromEndIsToEnd = true;

      track1IsChanged = true;
    }

    if (1 < t) {
      tracks[1].length *= t;

      track1IsChanged = true;
    }

    if (track1IsChanged)
      socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
        "tracks",
        toSerializableProp(["tracks", tracksState.selectedTracks[1]], tracks[1])
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

    if (index === 0 || index === 3 || index === 4 || index === 7) {
      railroadSwitch.connectedTrackIds = [tracksState.selectedTracks[1], curveId];
      railroadSwitch.isConnectedToEnd = [true, true];
      railroadSwitch.currentConnected = 0;

      tracks[1].idOfTrackOrSwitchConnectedFromEnd = trackB.id;
      tracks[1].connectedFromEndIsTrack = true;
      tracks[1].connectedFromEndIsToEnd = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = railroadSwitch.id;
      trackB.connectedFromStartIsTrack = false;
    } else {
      railroadSwitch.connectedTrackIds = [trackB.id, curveId];
      railroadSwitch.isConnectedToEnd = [false, true];
      railroadSwitch.currentConnected = 0;

      tracks[1].idOfTrackOrSwitchConnectedFromEnd = railroadSwitch.id;
      tracks[1].connectedFromEndIsTrack = false;
      trackB.idOfTrackOrSwitchConnectedFromStart = tracksState.selectedTracks[1];
      trackB.connectedFromStartIsTrack = true;
      trackB.connectedFromStartIsToEnd = true;
    }

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", trackB]]));

    tracks[1].length *= t;

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
      "tracks",
      toSerializableProp(["tracks", tracksState.selectedTracks[1]], tracks[1])
    ]]));

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["switches", railroadSwitch]]));
  }

  socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", curveTrack]]));

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
              tracksSubMenuState.addingTracks.splice(0, tracksSubMenuState.addingTracks.length);
            }}>
              <ArrowBackIcon />
            </Button>
            <TextField
              label="Controlled"
              defaultValue={tracksSubMenuState.curveRadius}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const radius = parseFloat(event.target.value);
                if (Number.isNaN(radius) || radius === 0) return;

                tracksSubMenuState.curveRadius = Math.max(-radius, radius);
                updateAddingTracks();
              }}
            />
          </>
            : <>
              <Button variant='contained' disabled={!tracksState.selectedTracks.length} onClick={() => {
                tracksState.selectedTracks.splice(0, tracksState.selectedTracks.length);
              }}>
                Deselect tracks
              </Button>
              <Button variant='contained' disabled={tracksState.selectedTracks.length !== 2} onClick={() => {
                let tracks: Track[] = [];

                tracksState.selectedTracks
                  .forEach(trackId => {
                    tracks.push(gameState.tracks[trackId]);
                  });

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
      </Paper >
    </>
  );
}