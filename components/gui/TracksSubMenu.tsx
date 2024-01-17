import * as React from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { Button, Paper, Stack, TextField } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { coordinateToEuler, getRelativePosition } from '@/lib/gis';
import { gameState } from '@/lib/client';
import centroid from '@turf/centroid';
import { Track, getPosition, state as tracksState } from '@/lib/tracks';
import { guiState } from './GUI';
import { lineString } from '@turf/helpers';

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
  const SRR = ((pointOffsetCR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetCR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDR.z - pointOffsetCR.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDR.x - pointOffsetCR.x));
  const SRL = ((pointOffsetCL.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetCL.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x))
    / ((pointOffsetBR.x - pointOffsetAR.x) * (pointOffsetDL.z - pointOffsetCL.z) - (pointOffsetBR.z - pointOffsetAR.z) * (pointOffsetDL.x - pointOffsetCL.x));

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
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 - rad),
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterLL.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 - rad),
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * rad,
        radius: -tracksSubMenuState.curveRadius,
      },
    ]
    : [
      {
        centerCoordinate,
        position: circleCenterLL.clone().add(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 + rad),
        radius: -tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB,
        length: tracksSubMenuState.curveRadius * -rad,
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterLL.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * -rad,
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterLR.clone().add(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI - rad),
        radius: tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRL.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI + rad),
        radius: -tracksSubMenuState.curveRadius,
      },
      {
        centerCoordinate,
        position: circleCenterRR.clone().sub(ABOffsetVector),
        rotationY: rotationYAB - Math.PI,
        length: tracksSubMenuState.curveRadius * (Math.PI * 2 + rad),
        radius: -tracksSubMenuState.curveRadius,
      },
    ];
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