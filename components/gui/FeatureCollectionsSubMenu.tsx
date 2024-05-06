import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { proxy, useSnapshot } from 'valtio';
import { Button, ButtonGroup, Drawer, Fab, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import StraightIcon from '@mui/icons-material/Straight';
import TableViewIcon from '@mui/icons-material/TableView';
import { FeatureAt, SelectAdjoinedLineStringSegments, state as gisState } from '@/lib/gis';
import { gameState } from '@/lib/client';
import { LineString, Position, lineString } from '@turf/helpers';
import centroid from '@turf/centroid';
import { SerializableTrack, Track, TransitionCurve, createStraightTrackFromLineStrings } from '@/lib/tracks';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game';
import { guiState } from './GUI';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';
import CurveEditMenu, { connectTwoStraightLinesWithCurve, curveEditMenuState, updateAddingTracks } from './CurveEditMenu';

export type CurveSegmentRange = {
  startIndex: number;
  endIndex: number;
};

export const featureCollectionsSubMenuState = proxy<{
  modelPaths: string[];
  segmentList: FeatureAt[];
  isStraightList: boolean[];
  nextSegmentList: FeatureAt[];
  focusedNextSegmentIndex: number;
  straightTracks: Track[];
  createCurveRangeIndex: number;
  createCurveIndices: number[];
  S: number[];
  T: number[];
  curves: Track[];
  addingTransitionsAB: (TransitionCurve | undefined)[];
  addingTransitionsCD: (TransitionCurve | undefined)[];
}>({
  modelPaths: [],
  segmentList: [],
  isStraightList: [],
  nextSegmentList: [],
  focusedNextSegmentIndex: -1,
  straightTracks: [],
  createCurveRangeIndex: -1,
  createCurveIndices: [],
  S: [],
  T: [],
  curves: [],
  addingTransitionsAB: [],
  addingTransitionsCD: [],
});

function ModelPaths() {
  const { modelPaths } = useSnapshot(featureCollectionsSubMenuState, { sync: true });

  return <>
    <Typography variant="h6" component="h1">
      Model paths
    </Typography>
    <IconButton color="primary" onClick={() => featureCollectionsSubMenuState.modelPaths.push("")}>
      <AddIcon />
    </IconButton>
    {modelPaths.map((_, index) => <Stack key={index} direction="row">
      <TextField
        value={modelPaths[index]}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          featureCollectionsSubMenuState.modelPaths[index] = event.target.value
        }
      />
      <IconButton color="primary" onClick={() =>
        featureCollectionsSubMenuState.modelPaths.splice(index, 1)
      }>
        <DeleteIcon />
      </IconButton>
    </Stack>)}
  </>;
}

function onUpdateSegmentList() {
  // 隣接するセグメントの一覧を取得する
  const lastFeatureAt = featureCollectionsSubMenuState.segmentList[featureCollectionsSubMenuState.segmentList.length - 1];

  featureCollectionsSubMenuState.nextSegmentList = SelectAdjoinedLineStringSegments(
    gameState,
    lastFeatureAt as FeatureAt & { segmentIndex: number },
    lastFeatureAt.featureCollectionId,
    featureCollectionsSubMenuState.segmentList,
  );

  if (featureCollectionsSubMenuState.nextSegmentList.length) {
    if (featureCollectionsSubMenuState.focusedNextSegmentIndex === -1 || featureCollectionsSubMenuState.nextSegmentList.length <= featureCollectionsSubMenuState.focusedNextSegmentIndex)
      featureCollectionsSubMenuState.focusedNextSegmentIndex = 0;
    focusingNextSegmentIndex();
  } else
    startCurveEditing();
}

function onUpdateCurveIndex() {
  setCameraTargetPosition(
    centroid(lineString([
      featureCollectionsSubMenuState.straightTracks[featureCollectionsSubMenuState.createCurveRangeIndex].centerCoordinate,
      featureCollectionsSubMenuState.straightTracks[featureCollectionsSubMenuState.createCurveRangeIndex + 1].centerCoordinate
    ])).geometry.coordinates,
    0
  );

  curveEditMenuState.AB = featureCollectionsSubMenuState.straightTracks[featureCollectionsSubMenuState.createCurveRangeIndex];
  curveEditMenuState.CD = featureCollectionsSubMenuState.straightTracks[featureCollectionsSubMenuState.createCurveRangeIndex + 1];
  updateAddingTracks();
}

function focusingNextSegmentIndex() {
  const nextFeatureAt = featureCollectionsSubMenuState.nextSegmentList[featureCollectionsSubMenuState.focusedNextSegmentIndex];
  if (nextFeatureAt.segmentIndex === undefined) return;

  const nextFeatureCollection = gameState.featureCollections[nextFeatureAt.featureCollectionId].value;
  const nextGeometry = nextFeatureCollection.features[nextFeatureAt.featureIndex].geometry;

  const coordinate = (nextGeometry as LineString).coordinates[nextFeatureAt.segmentIndex];
  const coordinate1 = (nextGeometry as LineString).coordinates[nextFeatureAt.segmentIndex + 1];

  setCameraTargetPosition(
    centroid(lineString([
      coordinate,
      coordinate1
    ])).geometry.coordinates,
    0
  );
}

function startCurveEditing() {
  featureCollectionsSubMenuState.straightTracks.splice(0);

  const coordinatePairs: Position[] = [];
  for (let index = 0; index <= featureCollectionsSubMenuState.segmentList.length; index++) {
    const isStraight = index !== featureCollectionsSubMenuState.segmentList.length
      && featureCollectionsSubMenuState.isStraightList[index];

    if (isStraight) {
      const segment = featureCollectionsSubMenuState.segmentList[index];

      const lineString =
        gameState.featureCollections[segment.featureCollectionId].value
          .features[segment.featureIndex]
          .geometry as LineString;

      coordinatePairs.push(
        lineString.coordinates[segment.segmentIndex!],
        lineString.coordinates[segment.segmentIndex! + 1],
      );
    } else if (coordinatePairs.length) {
      featureCollectionsSubMenuState.straightTracks.push(
        createStraightTrackFromLineStrings(
          coordinatePairs,
          featureCollectionsSubMenuState.modelPaths
        )
      );

      coordinatePairs.splice(0);
    }
  }

  // TODO straightTracksが平行する場合、結合する

  if (featureCollectionsSubMenuState.straightTracks.length < 2) {
    // TODO 曲線がない場合、直線のみ作成し、終了する

    featureCollectionsSubMenuState.straightTracks.splice(0);
    return;
  }

  featureCollectionsSubMenuState.createCurveIndices = new Array(featureCollectionsSubMenuState.straightTracks.length - 1).fill(-1);
  featureCollectionsSubMenuState.S = new Array(featureCollectionsSubMenuState.straightTracks.length - 1);
  featureCollectionsSubMenuState.T = new Array(featureCollectionsSubMenuState.straightTracks.length - 1);
  featureCollectionsSubMenuState.curves = new Array(featureCollectionsSubMenuState.straightTracks.length - 1);
  featureCollectionsSubMenuState.addingTransitionsAB = new Array(featureCollectionsSubMenuState.straightTracks.length - 1);
  featureCollectionsSubMenuState.addingTransitionsCD = new Array(featureCollectionsSubMenuState.straightTracks.length - 1);
  featureCollectionsSubMenuState.createCurveRangeIndex = 0;

  onUpdateCurveIndex();
}

export function onClickCurve(curveIndex: number, S: number, T: number, curve: Track, transitionCurveAB?: TransitionCurve, transitionCurveCD?: TransitionCurve) {
  featureCollectionsSubMenuState.createCurveIndices[featureCollectionsSubMenuState.createCurveRangeIndex] = curveIndex;
  featureCollectionsSubMenuState.S[featureCollectionsSubMenuState.createCurveRangeIndex] = S;
  featureCollectionsSubMenuState.T[featureCollectionsSubMenuState.createCurveRangeIndex] = T;
  featureCollectionsSubMenuState.curves[featureCollectionsSubMenuState.createCurveRangeIndex] = curve;
  featureCollectionsSubMenuState.addingTransitionsAB[featureCollectionsSubMenuState.createCurveRangeIndex] = transitionCurveAB;
  featureCollectionsSubMenuState.addingTransitionsCD[featureCollectionsSubMenuState.createCurveRangeIndex] = transitionCurveCD;

  if (featureCollectionsSubMenuState.createCurveRangeIndex + 1 < featureCollectionsSubMenuState.straightTracks.length - 1) {
    featureCollectionsSubMenuState.createCurveRangeIndex++;
    onUpdateCurveIndex();
  } else
    finishCreateTracks(); // 最後の曲線を選択した場合、軌道の作成を完了させる
}

export function finishCreateTracks() {
  let ABId: string = "";

  for (let i = 0; i < featureCollectionsSubMenuState.straightTracks.length; i++) {
    const CD = featureCollectionsSubMenuState.straightTracks[i];

    const CDId = uuidv4();

    socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
      "tracks",
      toSerializableProp(
        ["tracks", CDId],
        CD
      ) as SerializableTrack
    ]]));

    if (i !== 0) {
      const AB = featureCollectionsSubMenuState.straightTracks[i - 1];

      const curve = featureCollectionsSubMenuState.curves[i - 1];
      if (!curve) return;

      const s = featureCollectionsSubMenuState.S[i - 1];
      const t = featureCollectionsSubMenuState.T[i - 1];

      const transitionCurveAB = featureCollectionsSubMenuState.addingTransitionsAB[i - 1];
      const transitionCurveCD = featureCollectionsSubMenuState.addingTransitionsCD[i - 1];

      connectTwoStraightLinesWithCurve(
        AB,
        ABId,
        CD,
        CDId,
        featureCollectionsSubMenuState.createCurveIndices[i - 1],
        s,
        t,
        curve,
        transitionCurveAB,
        transitionCurveCD
      );

      ABId = CDId;
    }
  }

  resetEditing();
}

export function resetEditing() {
  featureCollectionsSubMenuState.segmentList = [];
  featureCollectionsSubMenuState.isStraightList = [];
  featureCollectionsSubMenuState.nextSegmentList = [];
  featureCollectionsSubMenuState.focusedNextSegmentIndex = -1;
  featureCollectionsSubMenuState.straightTracks = [];
  featureCollectionsSubMenuState.createCurveRangeIndex = -1;
  featureCollectionsSubMenuState.createCurveIndices = [];
  featureCollectionsSubMenuState.S = [];
  featureCollectionsSubMenuState.T = [];
  featureCollectionsSubMenuState.curves = [];
  featureCollectionsSubMenuState.addingTransitionsAB = [];
  featureCollectionsSubMenuState.addingTransitionsCD = [];
  curveEditMenuState.AB = undefined;
  curveEditMenuState.CD = undefined;
  curveEditMenuState.addingCurves.splice(0);
  curveEditMenuState.addingTransitionsAB.splice(0);
  curveEditMenuState.addingTransitionsCD.splice(0);
}

function MainMenu() {
  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return <>
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title="Toggle table" disableInteractive>
        <Fab size="small" color="primary" onClick={() => guiState.isShowTable = !guiState.isShowTable} sx={{
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <TableViewIcon />
        </Fab>
      </Tooltip>
      <div>Selected: {gisState.selectedFeatures.length}</div>
    </Stack>
    <Button variant='contained' disabled={!gisState.selectedFeatures.length} onClick={() => {
      gisState.selectedFeatures.splice(0, gisState.selectedFeatures.length);
    }}>
      Deselect features
    </Button>
    <Button variant='contained' disabled={gisState.selectedFeatures.length !== 1} onClick={() => {
      const startFeatureAt = gisState.selectedFeatures[0];
      const featureCollection = gameState.featureCollections[startFeatureAt.featureCollectionId].value;
      const geometry = featureCollection.features[startFeatureAt.featureIndex].geometry;
      if (geometry.type !== 'LineString') return;

      featureCollectionsSubMenuState.segmentList = [startFeatureAt];
      featureCollectionsSubMenuState.isStraightList = [true];

      onUpdateSegmentList();
    }}>
      Create track （選択された軌道を直線として平面曲線を作成する）
    </Button>
    <ButtonGroup variant="contained">
      <Button variant='contained' disabled={!gisState.selectedFeatures.length} onClick={() => {
        let coordinatePairs: Position[] = [];

        gisState.selectedFeatures
          .forEach(featureAt => {
            if (featureAt.segmentIndex === undefined) return

            const geometry =
              gameState.featureCollections[featureAt.featureCollectionId].value
                .features[featureAt.featureIndex]
                .geometry
            if (geometry.type === 'LineString') {
              coordinatePairs.push((geometry as LineString).coordinates[featureAt.segmentIndex])
              coordinatePairs.push((geometry as LineString).coordinates[featureAt.segmentIndex + 1])
            }
          });

        const track: SerializableTrack = toSerializableProp(
          ["tracks", uuidv4()],
          createStraightTrackFromLineStrings(
            coordinatePairs,
            featureCollectionsSubMenuState.modelPaths
          )
        );

        socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, [
          "tracks",
          track
        ]]));
      }}>
        Create new straight track
      </Button>
      <Button onClick={toggleDrawer(true)}>
        <SettingsIcon />
      </Button>
      <Drawer open={open} onClose={toggleDrawer(false)}>
        <Stack sx={{ width: 280 }}>
          <ModelPaths />
        </Stack>
      </Drawer>
    </ButtonGroup>
  </>;
}

function CreateTrackMenu() {
  return <>
    <Stack direction="row" spacing={1} alignItems="center">
      <div>Create track</div>
      <Button variant='outlined' onClick={() => resetEditing()}>
        Cancel
      </Button>
    </Stack>
    {featureCollectionsSubMenuState.curves.length ?
      <Paper>
        <Stack spacing={1}>
          <div>Curve: {featureCollectionsSubMenuState.createCurveRangeIndex + 1} / {featureCollectionsSubMenuState.straightTracks.length - 1}</div>
          <CurveEditMenu />
        </Stack>
      </Paper>
      : <>
        <Paper>
          Segments
          <Paper sx={{ m: 1 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <div>Next segment: {featureCollectionsSubMenuState.focusedNextSegmentIndex + 1} / {featureCollectionsSubMenuState.nextSegmentList.length}</div>
                <ButtonGroup variant="contained">
                  <Button variant='contained' disabled={!featureCollectionsSubMenuState.nextSegmentList.length} onClick={() => {
                    featureCollectionsSubMenuState.focusedNextSegmentIndex--;
                    if (featureCollectionsSubMenuState.focusedNextSegmentIndex < 0)
                      featureCollectionsSubMenuState.focusedNextSegmentIndex = featureCollectionsSubMenuState.nextSegmentList.length - 1;
                    focusingNextSegmentIndex();
                  }}>
                    {"<"}
                  </Button>
                  <Button variant='contained' disabled={!featureCollectionsSubMenuState.nextSegmentList.length} onClick={() => {
                    featureCollectionsSubMenuState.focusedNextSegmentIndex++;
                    if (featureCollectionsSubMenuState.nextSegmentList.length <= featureCollectionsSubMenuState.focusedNextSegmentIndex)
                      featureCollectionsSubMenuState.focusedNextSegmentIndex = 0;
                    focusingNextSegmentIndex();
                  }}>
                    {">"}
                  </Button>
                </ButtonGroup>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <AddIcon />
                  Add segment
                </Stack>
                <ButtonGroup variant="contained">
                  <Button variant='contained' startIcon={<StraightIcon />} onClick={() => {
                    featureCollectionsSubMenuState.segmentList.push(featureCollectionsSubMenuState.nextSegmentList[featureCollectionsSubMenuState.focusedNextSegmentIndex]);
                    featureCollectionsSubMenuState.isStraightList.push(true);
                    onUpdateSegmentList();
                  }}>
                    Straight
                  </Button>
                  <Button variant='contained' startIcon={<CircleOutlinedIcon />} onClick={() => {
                    featureCollectionsSubMenuState.segmentList.push(featureCollectionsSubMenuState.nextSegmentList[featureCollectionsSubMenuState.focusedNextSegmentIndex]);
                    featureCollectionsSubMenuState.isStraightList.push(false);
                    onUpdateSegmentList();
                  }}>
                    Curve
                  </Button>
                </ButtonGroup>
              </Stack>
            </Stack>
          </Paper>
        </Paper>
        <Button variant='contained' onClick={() => startCurveEditing()}>
          Create curves
        </Button>
      </>
    }
  </>;
}

export default function FeatureCollectionsSubMenu() {
  useSnapshot(guiState);
  useSnapshot(gisState);
  useSnapshot(featureCollectionsSubMenuState);

  return (
    <>
      <Paper sx={{ p: 1 }}>
        <Stack direction={'column'} spacing={1}>
          {
            featureCollectionsSubMenuState.segmentList.length
              ? <CreateTrackMenu />
              : <MainMenu />
          }
        </Stack>
      </Paper>
    </>
  );
}
