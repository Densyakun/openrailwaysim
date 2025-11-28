import * as React from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { proxy, useSnapshot } from 'valtio';
import { Button, ButtonGroup, Fab, Paper, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import DeselectIcon from '@mui/icons-material/Deselect';
import EditIcon from '@mui/icons-material/Edit';
import PlaceIcon from '@mui/icons-material/Place';
import StraightIcon from '@mui/icons-material/Straight';
import TableViewIcon from '@mui/icons-material/TableView';
import { FeatureAt, selectAdjoinedLineStringSegments, getCoordinateText, getRelativePosition, gisState } from '@/lib/gis';
import { Feature, LineString, Point, Position } from 'geojson';
import { lineString } from '@turf/helpers';
import centroid from '@turf/centroid';
import { point as turfPoint } from '@turf/helpers';
import { SerializableTrack, Track, TransitionCurve, createStraightTrackFromLineStrings, getPosition } from '@/lib/tracks';
import { socket } from '../Client';
import { store, toSerializableSaveData, trackTypeId } from '@/lib/game';
import CurveEditMenu, { connectTwoStraightLinesWithCurve, updateAddingTracks } from './CurveEditMenu';
import booleanEqual from '@turf/boolean-equal';
import FeatureCollectionTable from './FeatureCollectionTable';
import EditOriginCoordinatePanel from './EditOriginCoordinatePanel';
import { setCameraTargetPosition } from '@/lib/client/camera';
import { MessageCode, send } from '@/lib/ws';
import { curveEditMenuState } from '@/lib/client/curveEditMenu';

export type CurveSegmentRange = {
  startIndex: number;
  endIndex: number;
};

export const featureCollectionsTabPanelState = proxy<{
  isEditingOriginCoordinate: boolean;
  lon: number;
  lat: number;
  isShowTable: boolean;
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
  isEditingOriginCoordinate: false,
  lon: 0,
  lat: 0,
  isShowTable: false,
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

function onUpdateSegmentList() {
  const featureCollections = store.syncData.featureCollections;

  // 隣接するセグメントの一覧を取得する
  const lastFeatureAt = featureCollectionsTabPanelState.segmentList[featureCollectionsTabPanelState.segmentList.length - 1];
  if (lastFeatureAt.segmentIndex === undefined) return;

  const featureCollection = featureCollections[lastFeatureAt.featureCollectionId].value;

  const geometry = featureCollection.features[lastFeatureAt.featureIndex].geometry;
  const point = turfPoint((geometry as LineString).coordinates[lastFeatureAt.segmentIndex]);
  const point1 = turfPoint((geometry as LineString).coordinates[lastFeatureAt.segmentIndex + 1]);

  // 両端の点をpointsに代入する
  let points: Feature<Point>[] = [];

  if (featureCollectionsTabPanelState.segmentList.length === 1)
    points = [point, point1];
  else {
    let a = 0;
    let b = 0;

    for (let i = 0; i < featureCollectionsTabPanelState.segmentList.length; i++) {
      const segment = featureCollectionsTabPanelState.segmentList[i];

      if (booleanEqual(point, turfPoint((featureCollections[segment.featureCollectionId].value.features[segment.featureIndex].geometry as LineString).coordinates[segment.segmentIndex!]))
        || booleanEqual(point, turfPoint((featureCollections[segment.featureCollectionId].value.features[segment.featureIndex].geometry as LineString).coordinates[segment.segmentIndex! + 1]))) {
        a++;
        if (a === 2)
          break;
      }

      if (booleanEqual(point1, turfPoint((featureCollections[segment.featureCollectionId].value.features[segment.featureIndex].geometry as LineString).coordinates[segment.segmentIndex!]))
        || booleanEqual(point1, turfPoint((featureCollections[segment.featureCollectionId].value.features[segment.featureIndex].geometry as LineString).coordinates[segment.segmentIndex! + 1]))) {
        b++;
        if (b === 2)
          break;
      }
    }

    if (a !== 2) {
      if (b !== 2)
        points = [point, point1];
      else
        points = [point];
    } else if (b !== 2)
      points = [point1];
  };

  featureCollectionsTabPanelState.nextSegmentList = selectAdjoinedLineStringSegments(
    store.syncData,
    points,
    lastFeatureAt.featureCollectionId,
    featureCollectionsTabPanelState.segmentList,
  );

  if (featureCollectionsTabPanelState.nextSegmentList.length) {
    if (featureCollectionsTabPanelState.focusedNextSegmentIndex === -1 || featureCollectionsTabPanelState.nextSegmentList.length <= featureCollectionsTabPanelState.focusedNextSegmentIndex)
      featureCollectionsTabPanelState.focusedNextSegmentIndex = 0;
    focusingNextSegmentIndex();
  } else
    startCurveEditing();
}

function onUpdateCurveIndex() {
  const AB = featureCollectionsTabPanelState.straightTracks[featureCollectionsTabPanelState.createCurveRangeIndex];
  const CD = featureCollectionsTabPanelState.straightTracks[featureCollectionsTabPanelState.createCurveRangeIndex + 1];

  setCameraTargetPosition(
    getPosition(AB, AB.length / 2)
      .add(getPosition(CD, CD.length / 2))
      .divideScalar(2)
  );

  curveEditMenuState.AB = AB;
  curveEditMenuState.CD = CD;
  updateAddingTracks();
}

function focusingNextSegmentIndex() {
  const nextFeatureAt = featureCollectionsTabPanelState.nextSegmentList[featureCollectionsTabPanelState.focusedNextSegmentIndex];
  if (nextFeatureAt.segmentIndex === undefined) return;

  const nextFeatureCollection = store.syncData.featureCollections[nextFeatureAt.featureCollectionId].value;
  const nextGeometry = nextFeatureCollection.features[nextFeatureAt.featureIndex].geometry;

  const coordinate = (nextGeometry as LineString).coordinates[nextFeatureAt.segmentIndex];
  const coordinate1 = (nextGeometry as LineString).coordinates[nextFeatureAt.segmentIndex + 1];

  setCameraTargetPosition(
    getRelativePosition(
      centroid(lineString([
        coordinate,
        coordinate1
      ])).geometry.coordinates,
      store.syncData.originCoordinate
    )
  );
}

function startCurveEditing() {
  featureCollectionsTabPanelState.straightTracks.splice(0);

  const coordinatePairs: Position[] = [];
  for (let index = 0; index <= featureCollectionsTabPanelState.segmentList.length; index++) {
    const isStraight = index !== featureCollectionsTabPanelState.segmentList.length
      && featureCollectionsTabPanelState.isStraightList[index];

    if (isStraight) {
      const segment = featureCollectionsTabPanelState.segmentList[index];

      const lineString =
        store.syncData.featureCollections[segment.featureCollectionId].value
          .features[segment.featureIndex]
          .geometry as LineString;

      coordinatePairs.push(
        lineString.coordinates[segment.segmentIndex!],
        lineString.coordinates[segment.segmentIndex! + 1],
      );
    } else if (coordinatePairs.length) {
      featureCollectionsTabPanelState.straightTracks.push(
        createStraightTrackFromLineStrings(
          store.syncData.originCoordinate,
          coordinatePairs,
        )
      );

      coordinatePairs.splice(0);
    }
  }

  // TODO straightTracksが平行する場合、結合する

  if (featureCollectionsTabPanelState.straightTracks.length < 2) {
    // TODO 曲線がない場合、直線のみ作成し、終了する

    featureCollectionsTabPanelState.straightTracks.splice(0);
    return;
  }

  featureCollectionsTabPanelState.createCurveIndices = new Array(featureCollectionsTabPanelState.straightTracks.length - 1).fill(-1);
  featureCollectionsTabPanelState.S = new Array(featureCollectionsTabPanelState.straightTracks.length - 1);
  featureCollectionsTabPanelState.T = new Array(featureCollectionsTabPanelState.straightTracks.length - 1);
  featureCollectionsTabPanelState.curves = new Array(featureCollectionsTabPanelState.straightTracks.length - 1);
  featureCollectionsTabPanelState.addingTransitionsAB = new Array(featureCollectionsTabPanelState.straightTracks.length - 1);
  featureCollectionsTabPanelState.addingTransitionsCD = new Array(featureCollectionsTabPanelState.straightTracks.length - 1);
  featureCollectionsTabPanelState.createCurveRangeIndex = 0;

  onUpdateCurveIndex();
}

export function onClickCurve(curveIndex: number, S: number, T: number, curve: Track, transitionCurveAB?: TransitionCurve, transitionCurveCD?: TransitionCurve) {
  featureCollectionsTabPanelState.createCurveIndices[featureCollectionsTabPanelState.createCurveRangeIndex] = curveIndex;
  featureCollectionsTabPanelState.S[featureCollectionsTabPanelState.createCurveRangeIndex] = S;
  featureCollectionsTabPanelState.T[featureCollectionsTabPanelState.createCurveRangeIndex] = T;
  featureCollectionsTabPanelState.curves[featureCollectionsTabPanelState.createCurveRangeIndex] = curve;
  featureCollectionsTabPanelState.addingTransitionsAB[featureCollectionsTabPanelState.createCurveRangeIndex] = transitionCurveAB;
  featureCollectionsTabPanelState.addingTransitionsCD[featureCollectionsTabPanelState.createCurveRangeIndex] = transitionCurveCD;

  if (featureCollectionsTabPanelState.createCurveRangeIndex + 1 < featureCollectionsTabPanelState.straightTracks.length - 1) {
    featureCollectionsTabPanelState.createCurveRangeIndex++;
    onUpdateCurveIndex();
  } else
    finishCreateTracks(); // 最後の曲線を選択した場合、軌道の作成を完了させる
}

export function finishCreateTracks() {
  let ABId: string = "";

  for (let i = 0; i < featureCollectionsTabPanelState.straightTracks.length; i++) {
    const CD = featureCollectionsTabPanelState.straightTracks[i];

    const CDId = uuidv4();

    send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", CDId],
      toSerializableSaveData(
        trackTypeId,
        CD,
        store.syncData
      ) as SerializableTrack
    ]);

    if (i !== 0) {
      const AB = featureCollectionsTabPanelState.straightTracks[i - 1];

      const curve = featureCollectionsTabPanelState.curves[i - 1];
      if (!curve) return;

      const s = featureCollectionsTabPanelState.S[i - 1];
      const t = featureCollectionsTabPanelState.T[i - 1];

      const transitionCurveAB = featureCollectionsTabPanelState.addingTransitionsAB[i - 1];
      const transitionCurveCD = featureCollectionsTabPanelState.addingTransitionsCD[i - 1];

      connectTwoStraightLinesWithCurve(
        AB,
        ABId,
        CD,
        CDId,
        featureCollectionsTabPanelState.createCurveIndices[i - 1],
        s,
        t,
        curve,
        transitionCurveAB,
        transitionCurveCD,
        false
      );
    }

    ABId = CDId;
  }

  resetEditing();
}

export function resetEditing() {
  featureCollectionsTabPanelState.segmentList = [];
  featureCollectionsTabPanelState.isStraightList = [];
  featureCollectionsTabPanelState.nextSegmentList = [];
  featureCollectionsTabPanelState.focusedNextSegmentIndex = -1;
  featureCollectionsTabPanelState.straightTracks = [];
  featureCollectionsTabPanelState.createCurveRangeIndex = -1;
  featureCollectionsTabPanelState.createCurveIndices = [];
  featureCollectionsTabPanelState.S = [];
  featureCollectionsTabPanelState.T = [];
  featureCollectionsTabPanelState.curves = [];
  featureCollectionsTabPanelState.addingTransitionsAB = [];
  featureCollectionsTabPanelState.addingTransitionsCD = [];
  curveEditMenuState.AB = undefined;
  curveEditMenuState.CD = undefined;
  curveEditMenuState.addingCurves.splice(0);
  curveEditMenuState.addingTransitionsAB.splice(0);
  curveEditMenuState.addingTransitionsCD.splice(0);
}

function OriginCoordinateReadOnlyTextField() {
  const { originCoordinate } = useSnapshot(store.syncData);

  return <TextField
    variant="standard"
    label="Origin coordinate"
    defaultValue={getCoordinateText(originCoordinate as Position)}
    slotProps={{
      input: {
        readOnly: true,
      },
    }}
  />;
}

function MainMenu() {
  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const count: { [key: string]: number } = {};
  gisState.selectedFeatures.forEach(featureAt => {
    if (count[featureAt.featureCollectionId] === undefined)
      count[featureAt.featureCollectionId] = 1;
    else
      count[featureAt.featureCollectionId]++;
  });

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title="Toggle table" disableInteractive>
          <Fab size="small" color="primary" onClick={() => featureCollectionsTabPanelState.isShowTable = true} sx={{
            pointerEvents: 'auto',
            userSelect: 'none'
          }}>
            <TableViewIcon />
          </Fab>
        </Tooltip>
        <div>Selected: {gisState.selectedFeatures.length}</div>
        {Object.keys(count).map(key => <div key={key}> {key}: {count[key]}</div>)}
      </Stack>
      <Button variant='contained' startIcon={<DeselectIcon />} disabled={!gisState.selectedFeatures.length} onClick={() => {
        gisState.selectedFeatures.splice(0, gisState.selectedFeatures.length);
      }}>
        Deselect
      </Button>
      <Button variant='contained' disabled={gisState.selectedFeatures.length !== 1} onClick={() => {
        const startFeatureAt = gisState.selectedFeatures[0];
        const featureCollection = store.syncData.featureCollections[startFeatureAt.featureCollectionId].value;
        const geometry = featureCollection.features[startFeatureAt.featureIndex].geometry;
        if (geometry.type !== 'LineString') return;

        featureCollectionsTabPanelState.segmentList = [startFeatureAt];
        featureCollectionsTabPanelState.isStraightList = [true];

        onUpdateSegmentList();
      }}>
        Create continuous tracks （選択された軌道を直線として平面曲線を作成する）
      </Button>
      <Button variant='contained' disabled={!gisState.selectedFeatures.length} onClick={() => {
        let coordinatePairs: Position[] = [];

        gisState.selectedFeatures
          .forEach(featureAt => {
            if (featureAt.segmentIndex === undefined) return

            const geometry =
              store.syncData.featureCollections[featureAt.featureCollectionId].value
                .features[featureAt.featureIndex]
                .geometry
            if (geometry.type === 'LineString') {
              coordinatePairs.push((geometry as LineString).coordinates[featureAt.segmentIndex])
              coordinatePairs.push((geometry as LineString).coordinates[featureAt.segmentIndex + 1])
            }
          });

        const trackId = uuidv4();
        const track: SerializableTrack = toSerializableSaveData(
          trackTypeId,
          createStraightTrackFromLineStrings(
            store.syncData.originCoordinate,
            coordinatePairs,
          ),
          store.syncData
        );

        send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
          ["tracks", trackId],
          track
        ]);
      }}>
        Create new straight track
      </Button>
      <Stack direction="row" spacing={1} alignItems="center">
        <PlaceIcon />
        <OriginCoordinateReadOnlyTextField />
        <Button variant='contained' startIcon={<EditIcon />} onClick={() => {
          featureCollectionsTabPanelState.isEditingOriginCoordinate = true;
          featureCollectionsTabPanelState.lon = store.syncData.originCoordinate[0];
          featureCollectionsTabPanelState.lat = store.syncData.originCoordinate[1];
        }}>
          Edit
        </Button>
        <Button variant='contained' onClick={() => {
          setCameraTargetPosition(new THREE.Vector3())
        }}>
          Move to origin
        </Button>
      </Stack>
    </Stack>
  </Paper>;
}

function CreateTrackMenu() {
  let { curves, createCurveRangeIndex, straightTracks, focusedNextSegmentIndex, nextSegmentList } = useSnapshot(featureCollectionsTabPanelState);

  curves = featureCollectionsTabPanelState.curves;
  createCurveRangeIndex = featureCollectionsTabPanelState.createCurveRangeIndex;
  straightTracks = featureCollectionsTabPanelState.straightTracks;
  focusedNextSegmentIndex = featureCollectionsTabPanelState.focusedNextSegmentIndex;
  nextSegmentList = featureCollectionsTabPanelState.nextSegmentList;

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <div>Create track</div>
        <Button variant='outlined' onClick={() => resetEditing()}>
          Cancel
        </Button>
      </Stack>
      {curves.length ?
        <Paper>
          <Stack spacing={1}>
            <div>Curve: {createCurveRangeIndex + 1} / {straightTracks.length - 1}</div>
            <CurveEditMenu />
          </Stack>
        </Paper>
        : <>
          <Paper>
            Segments
            <Paper sx={{ m: 1 }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <div>Next segment: {focusedNextSegmentIndex + 1} / {nextSegmentList.length}</div>
                  <ButtonGroup variant="contained">
                    <Button variant='contained' disabled={!nextSegmentList.length} onClick={() => {
                      featureCollectionsTabPanelState.focusedNextSegmentIndex--;
                      if (featureCollectionsTabPanelState.focusedNextSegmentIndex < 0)
                        featureCollectionsTabPanelState.focusedNextSegmentIndex = featureCollectionsTabPanelState.nextSegmentList.length - 1;
                      focusingNextSegmentIndex();
                    }}>
                      {"<"}
                    </Button>
                    <Button variant='contained' disabled={!nextSegmentList.length} onClick={() => {
                      featureCollectionsTabPanelState.focusedNextSegmentIndex++;
                      if (featureCollectionsTabPanelState.nextSegmentList.length <= featureCollectionsTabPanelState.focusedNextSegmentIndex)
                        featureCollectionsTabPanelState.focusedNextSegmentIndex = 0;
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
                      featureCollectionsTabPanelState.segmentList.push(featureCollectionsTabPanelState.nextSegmentList[featureCollectionsTabPanelState.focusedNextSegmentIndex]);
                      featureCollectionsTabPanelState.isStraightList.push(true);
                      onUpdateSegmentList();
                    }}>
                      Straight
                    </Button>
                    <Button variant='contained' startIcon={<CircleOutlinedIcon />} onClick={() => {
                      featureCollectionsTabPanelState.segmentList.push(featureCollectionsTabPanelState.nextSegmentList[featureCollectionsTabPanelState.focusedNextSegmentIndex]);
                      featureCollectionsTabPanelState.isStraightList.push(false);
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
    </Stack>
  </Paper>;
}

export default function FeatureCollectionsTabPanel() {
  useSnapshot(gisState);
  const { isEditingOriginCoordinate, isShowTable, segmentList } = useSnapshot(featureCollectionsTabPanelState);

  return isEditingOriginCoordinate
    ? <EditOriginCoordinatePanel />
    : isShowTable
      ? <FeatureCollectionTable />
      : segmentList.length
        ? <CreateTrackMenu />
        : <MainMenu />;
}
