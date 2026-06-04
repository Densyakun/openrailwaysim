import { proxy, useSnapshot } from 'valtio';
import { Alert, Button, ButtonGroup, Checkbox, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import DeselectIcon from '@mui/icons-material/Deselect';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { TrackModel, getPosition } from '@/lib/tracks';
import { socket } from '../Client';
import CurveEditMenu from './CurveEditMenu';
import { getSelectedTracks } from "@/lib/client/tracks/index";
import { tracksState, offsetTrackState } from "@/lib/client/tracks/store";
import React from 'react';
import { MessageCode, send } from '@/lib/ws';
import { curveEditMenuState } from '@/lib/client/curveEditMenu';
import { Path, PathValue, SerializableORSAppDataType, store } from '@/lib/game';
import EditTracksInDiagramPanel, { editTracksInDiagramState, getConnectedTracks } from './EditTracksInDiagramPanel';
import { setCameraTargetPosition } from '@/lib/client/camera';
import VerticalCurveEditor from './VerticalCurveEditPanel';
import { verticalCurveEditState } from '@/lib/client/verticalCurveEdit';
import { offsetTrackRoute, VEHICLE_OFFSET_CONSTANT } from '@/lib/tracks';
import { v4 as uuidv4 } from 'uuid';

export const tracksSubMenuState = proxy<{
  isAddingCurve: boolean;
  hoveredAddingTracks: number;
  isEditingModels: boolean;
  isOffsetting: boolean;
  trackModels: {
    modelPath: string;
    start: string;
    end: string;
    isInclined: boolean;
    isTilting: boolean;
    span: string;
    interval: string;
    minDistance: string;
    maxDistance: string;
  }[];
  editingTrackId: string;
  beginCant: string;
  endCant: string;
  tracksIsEditing: boolean;
  editingTrackIds: string[];
}>({
  isAddingCurve: false,
  hoveredAddingTracks: -1,
  isEditingModels: false,
  isOffsetting: false,
  trackModels: [],
  editingTrackId: "",
  beginCant: "",
  endCant: "",
  tracksIsEditing: false,
  editingTrackIds: [],
});

function TrackModelSettings() {
  const { trackModels } = useSnapshot(tracksSubMenuState, { sync: true });

  return <Stack direction={'column'} spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <div>Track model settings</div>
      <Button variant='outlined' onClick={() => {
        tracksSubMenuState.isEditingModels = false;
        tracksSubMenuState.trackModels = [];
      }}>
        Cancel
      </Button>
    </Stack>
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h6" component="h1">
          Model paths: {trackModels.length}
        </Typography>
        <IconButton color="primary" onClick={() => tracksSubMenuState.trackModels.push({
          modelPath: "",
          start: "0",
          end: "-1",
          isInclined: true,
          isTilting: true,
          interval: "0",
          span: "0",
          minDistance: "0",
          maxDistance: "0",
        })}>
          <AddIcon />
        </IconButton>
      </Stack>
      <TableContainer component={Paper} sx={{ height: "80px", overflow: "scroll" }}>
        <Table size="small">
          <TableHead sx={{ whiteSpace: "nowrap" }}>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell align="right">Path</TableCell>
              <TableCell align="right">Start</TableCell>
              <TableCell align="right">End</TableCell>
              <TableCell align="right">Inclined</TableCell>
              <TableCell align="right">Tilting</TableCell>
              <TableCell align="right">Span</TableCell>
              <TableCell align="right">Interval</TableCell>
              <TableCell align="right">Min dist.</TableCell>
              <TableCell align="right">Max dist.</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trackModels.map((trackModel, index) => <TableRow
              key={index}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {index + 1}
              </TableCell>
              <TableCell align="right">
                <TextField
                  sx={{ width: 128 }}
                  value={trackModel.modelPath}
                  size="small"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    tracksSubMenuState.trackModels[index].modelPath = event.target.value
                  }
                />
              </TableCell>
              <TableCell align="right">
                <TextField
                  sx={{ width: 64 }}
                  value={trackModel.start}
                  size="small"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    tracksSubMenuState.trackModels[index].start = event.target.value
                  }
                />
              </TableCell>
              <TableCell align="right">
                <TextField
                  sx={{ width: 64 }}
                  value={trackModel.end}
                  size="small"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    tracksSubMenuState.trackModels[index].end = event.target.value
                  }
                />
              </TableCell>
              <TableCell align="right">
                <Checkbox size="small" checked={trackModel.isInclined} onChange={event =>
                  tracksSubMenuState.trackModels[index].isInclined = event.target.checked
                } />
              </TableCell>
              <TableCell align="right">
                <Checkbox size="small" checked={trackModel.isTilting} onChange={event =>
                  tracksSubMenuState.trackModels[index].isTilting = event.target.checked
                } />
              </TableCell>
              <TableCell align="right">
                <TextField
                  sx={{ width: 64 }}
                  value={trackModel.span}
                  size="small"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    tracksSubMenuState.trackModels[index].span = event.target.value
                  }
                />
              </TableCell>
              <TableCell align="right">
                <TextField
                  sx={{ width: 64 }}
                  disabled={trackModel.start === trackModel.end}
                  value={trackModel.interval}
                  size="small"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    tracksSubMenuState.trackModels[index].interval = event.target.value
                  }
                />
              </TableCell>
              <TableCell align="right">
                <TextField
                  sx={{ width: 64 }}
                  value={trackModel.minDistance}
                  size="small"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    tracksSubMenuState.trackModels[index].minDistance = event.target.value
                  }
                />
              </TableCell>
              <TableCell align="right">
                <TextField
                  sx={{ width: 64 }}
                  value={trackModel.maxDistance}
                  size="small"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    tracksSubMenuState.trackModels[index].maxDistance = event.target.value
                  }
                />
              </TableCell>
              <TableCell align="right">
                <IconButton color="primary" size="small" onClick={() =>
                  tracksSubMenuState.trackModels.splice(index, 1)
                }>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
    <Button variant="contained" startIcon={<SaveIcon />}
      onClick={() => {
        // TODO エラーハンドリング
        // TODO 0や-1を入力する代わりにチェックボックスで設定できるようにする
        // TODO レール用の場合に不要な入力を無効化する
        tracksState.selectedTrackIds.forEach(trackId => {
          send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
            ["tracks", trackId, "trackModels"],
            tracksSubMenuState.trackModels.map(trackModel => {
              const trackModel_: TrackModel = {
                modelPath: trackModel.modelPath,
                start: parseFloat(trackModel.start),
                end: parseFloat(trackModel.end),
                isInclined: trackModel.isInclined,
                isTilting: trackModel.isTilting,
                span: parseFloat(trackModel.span),
                interval: trackModel.start === trackModel.end ? 0 : parseFloat(trackModel.interval),
                minDistance: parseFloat(trackModel.minDistance),
                maxDistance: parseFloat(trackModel.maxDistance),
              };

              return trackModel_;
            })
          ]);
        });
      }}>
      Save
    </Button>
  </Stack>;
}

export default function TracksSubMenu() {
  const { isEditingModels, isAddingCurve, editingTrackId, tracksIsEditing, isOffsetting } = useSnapshot(tracksSubMenuState);
  const { isEditing: isEditingVerticalCurve, trackIds: verticalCurveTrackIds } = useSnapshot(verticalCurveEditState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    {isEditingModels
      ? <TrackModelSettings />
      : isAddingCurve
        ? <AddingCurve />
        : editingTrackId
          ? <TrackEditMenu />
          : tracksIsEditing
            ? <TrackRouteSelectionPanel />
            : isEditingVerticalCurve
              ? (verticalCurveTrackIds.length > 0 && verticalCurveEditState.gradientPoints.length > 0
                ? <VerticalCurveEditor />
                : null)
              : isOffsetting
                ? <OffsetTrackMenu />
                : <MainMenu />}
  </Paper>;
}

function MainMenu() {
  const { selectedTrackIds } = useSnapshot(tracksState);

  return <Stack direction={'column'} spacing={1}>
    <div>Selected: {selectedTrackIds.length}</div>
    <Button variant='contained' startIcon={<DeselectIcon />} disabled={!selectedTrackIds.length} onClick={() => {
      tracksState.selectedTrackIds.splice(0, tracksState.selectedTrackIds.length);
    }}>
      Deselect
    </Button>
    <Button variant='contained' startIcon={<EditIcon />} disabled={selectedTrackIds.length !== 1} onClick={() => {
      const track = store.data.tracks[tracksSubMenuState.editingTrackId = selectedTrackIds[0]];
      tracksSubMenuState.beginCant = track.beginCant.toString();
      tracksSubMenuState.endCant = track.endCant.toString();
    }}>
      Edit
    </Button>
    <Button variant='contained' startIcon={<DeleteIcon />} disabled={!selectedTrackIds.length} onClick={() =>
      tracksState.selectedTrackIds.forEach(trackId =>
        send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["tracks", trackId])
      )
    }>
      Delete
    </Button>
    <Button variant='contained' disabled={selectedTrackIds.length !== 2} onClick={() => {
      const tracks = getSelectedTracks();

      // 平行の場合
      if (tracks[0].rotationY === tracks[1].rotationY) return;

      curveEditMenuState.AB = tracks[0];
      curveEditMenuState.CD = tracks[1];
      tracksSubMenuState.isAddingCurve = true;
    }}>
      Create new curve
    </Button>
    <Button variant='contained' disabled={!selectedTrackIds.length} onClick={() => {
      tracksSubMenuState.isOffsetting = true;
    }}>
      Offset track
    </Button>
    <Button variant='contained' disabled={!selectedTrackIds.length} onClick={() =>
      tracksState.selectedTrackIds.forEach(trackId => {
        send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
          ["tracks", trackId, "trackModels"],
          [{
            modelPath: "https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-1067.gltf",
            start: 0,
            end: -1,
            isInclined: true,
            isTilting: true,
            span: 0,
            interval: 0,
            minDistance: 0,
            maxDistance: 0,
          }]
        ]);
      })
    }>
      Test model
    </Button>
    <Button variant='contained' disabled={!selectedTrackIds.length} onClick={() => {
      tracksSubMenuState.isEditingModels = true;
      tracksSubMenuState.trackModels = store.data.tracks[tracksState.selectedTrackIds[0]].trackModels.map(trackModel => ({
        modelPath: trackModel.modelPath,
        start: trackModel.start.toString(),
        end: trackModel.end.toString(),
        isInclined: trackModel.isInclined,
        isTilting: trackModel.isTilting,
        span: trackModel.span.toString(),
        interval: trackModel.interval.toString(),
        minDistance: trackModel.minDistance.toString(),
        maxDistance: trackModel.maxDistance.toString(),
      }));
    }}>
      Model settings
    </Button>
    <Button variant='contained' disabled={!selectedTrackIds.length} onClick={() => {
      tracksSubMenuState.tracksIsEditing = true;
      tracksSubMenuState.editingTrackIds = [...selectedTrackIds];
      editTracksInDiagramState.nextTrackIds = [];
      editTracksInDiagramState.focusedNextTrackIndex = -1;
      // Calculate next tracks
      if (tracksSubMenuState.editingTrackIds.length) {
        const lastTrackId = tracksSubMenuState.editingTrackIds[tracksSubMenuState.editingTrackIds.length - 1];
        const track = store.data.tracks[lastTrackId];
        editTracksInDiagramState.nextTrackIds = getConnectedTracks(track, tracksSubMenuState.editingTrackIds);
        if (editTracksInDiagramState.focusedNextTrackIndex === -1 || editTracksInDiagramState.nextTrackIds.length <= editTracksInDiagramState.focusedNextTrackIndex)
          editTracksInDiagramState.focusedNextTrackIndex = 0;
      }
      // Set up vertical curve edit state
      verticalCurveEditState.trackIds = [...selectedTrackIds];
      // Initialize gradient points from existing track gradients
      let totalLength = 0;
      const trackLengths: number[] = [];
      for (const trackId of selectedTrackIds) {
        const track = store.data.tracks[trackId];
        trackLengths.push(track.length);
        totalLength += track.length;
      }
      let currentLength = 0;
      const initialGradientPoints: { position: string; gradient: string }[] = [];
      for (let i = 0; i < selectedTrackIds.length; i++) {
        const trackId = selectedTrackIds[i];
        const track = store.data.tracks[trackId];
        const trackLength = trackLengths[i];
        const trackStart = currentLength;
        const trackEnd = currentLength + trackLength;

        // Add gradient points from this track
        for (const [position, gradient] of Object.entries(track.gradients)) {
          const absolutePosition = trackStart + parseFloat(position);
          initialGradientPoints.push({
            position: absolutePosition.toString(),
            gradient: gradient.toString()
          });
        }

        currentLength += trackLength;
      }
      verticalCurveEditState.gradientPoints = initialGradientPoints;
    }}>
      Edit vertical curve
    </Button>
  </Stack>;
}

function AddingCurve() {
  return <Stack direction={'column'} spacing={1}>
    <Button variant='outlined' onClick={() => {
      tracksSubMenuState.isAddingCurve = false;
      curveEditMenuState.addingCurves.splice(0);
      curveEditMenuState.addingTransitionsAB.splice(0);
      curveEditMenuState.addingTransitionsCD.splice(0);
    }}>
      <ArrowBackIcon />
    </Button>
    <CurveEditMenu />
  </Stack>;
}

function TrackRouteSelectionPanel() {
  const { editingTrackIds } = useSnapshot(tracksSubMenuState);
  const {
    focusedNextTrackIndex,
    nextTrackIds,
  } = useSnapshot(editTracksInDiagramState);

  function onUpdateTrackList() {
    if (!editingTrackIds.length) {
      editTracksInDiagramState.nextTrackIds = [];
      editTracksInDiagramState.focusedNextTrackIndex = -1;
      return;
    }

    const lastTrackId = editingTrackIds[editingTrackIds.length - 1];
    const track = store.data.tracks[lastTrackId];

    editTracksInDiagramState.nextTrackIds = getConnectedTracks(
      track,
      editingTrackIds as string[],
    );

    if (editTracksInDiagramState.focusedNextTrackIndex === -1 || editTracksInDiagramState.nextTrackIds.length <= editTracksInDiagramState.focusedNextTrackIndex)
      editTracksInDiagramState.focusedNextTrackIndex = 0;
    focusingNextSegmentIndex();
  }

  function focusingNextSegmentIndex() {
    if (!editTracksInDiagramState.nextTrackIds.length) return;

    const nextTrackId = editTracksInDiagramState.nextTrackIds[editTracksInDiagramState.focusedNextTrackIndex];
    const nextTrack = store.data.tracks[nextTrackId];

    setCameraTargetPosition(getPosition(nextTrack, nextTrack.length / 2));
  }

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <div>Select track route for vertical curve</div>
        <Button variant='outlined' onClick={() => {
          tracksSubMenuState.tracksIsEditing = false;
          tracksSubMenuState.editingTrackIds = [];
          tracksState.pointingOnTrack = undefined;
        }}>
          Back
        </Button>
      </Stack>
      {editingTrackIds.length
        ? <Paper>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <div>Selected tracks: {editingTrackIds.length}</div>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <div>Next track: {focusedNextTrackIndex + 1} / {nextTrackIds.length}</div>
              <ButtonGroup variant="contained">
                <Button variant='contained' disabled={!nextTrackIds.length} onClick={() => {
                  editTracksInDiagramState.focusedNextTrackIndex--;
                  if (editTracksInDiagramState.focusedNextTrackIndex < 0)
                    editTracksInDiagramState.focusedNextTrackIndex = nextTrackIds.length - 1;
                  focusingNextSegmentIndex();
                }}>
                  {"<"}
                </Button>
                <Button variant='contained' disabled={!nextTrackIds.length} onClick={() => {
                  editTracksInDiagramState.focusedNextTrackIndex++;
                  if (nextTrackIds.length <= editTracksInDiagramState.focusedNextTrackIndex)
                    editTracksInDiagramState.focusedNextTrackIndex = 0;
                  focusingNextSegmentIndex();
                }}>
                  {">"}
                </Button>
              </ButtonGroup>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant='contained' startIcon={<AddIcon />} disabled={!nextTrackIds.length} onClick={() => {
                tracksSubMenuState.editingTrackIds.push(nextTrackIds[focusedNextTrackIndex]);
                onUpdateTrackList();
              }}>
                Add
              </Button>
              <Button variant='contained' onClick={() => {
                tracksSubMenuState.editingTrackIds.pop();
                onUpdateTrackList();
              }} disabled={!editingTrackIds.length}>
                Remove last
              </Button>
            </Stack>
            <Button variant='contained' disabled={!editingTrackIds.length} onClick={() => {
              verticalCurveEditState.isEditing = true;
              verticalCurveEditState.trackIds = [...editingTrackIds];
              verticalCurveEditState.gradientPoints = [];
              tracksSubMenuState.tracksIsEditing = false;
              initializeGradientPoints();
            }}>
              Edit vertical curve
            </Button>
          </Stack>
        </Paper>
        : <Alert severity="error">
          軌道を選択して追加してください
        </Alert>
      }
    </Stack>
  </Paper>;
}

function initializeGradientPoints() {
  let totalLength = 0;
  for (const trackId of verticalCurveEditState.trackIds) {
    const track = store.data.tracks[trackId];
    totalLength += track.length;
  }

  verticalCurveEditState.gradientPoints = [
    { position: "0", gradient: "0" },
    { position: totalLength.toString(), gradient: "0" }
  ];
}

function TrackEditMenu() {
  const {
    beginCant,
    endCant,
  } = useSnapshot(tracksSubMenuState, { sync: true });

  return <Stack direction={'column'} spacing={1}>
    <Button variant='outlined' onClick={() => tracksSubMenuState.editingTrackId = ""}>
      <ArrowBackIcon />
    </Button>
    <TextField
      label="Begin cant"
      value={beginCant}
      size="small"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => tracksSubMenuState.beginCant = event.target.value}
    />
    <TextField
      label="End cant"
      value={endCant}
      size="small"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => tracksSubMenuState.endCant = event.target.value}
    />
    <Button variant="contained" startIcon={<SaveIcon />}
      disabled={isNaN(parseFloat(beginCant)) || isNaN(parseFloat(endCant))}
      onClick={() => {
        const beginCant = tracksSubMenuState.beginCant;
        const endCant = tracksSubMenuState.endCant;
        if (isNaN(parseFloat(beginCant)) || isNaN(parseFloat(endCant))) return;

        const messages: [MessageCode.FROM_CLIENT_SET_PROP, [Path<SerializableORSAppDataType>, PathValue<SerializableORSAppDataType, Path<SerializableORSAppDataType>>, Path<SerializableORSAppDataType>?]][] = [
          [MessageCode.FROM_CLIENT_SET_PROP, [
            ["tracks", tracksSubMenuState.editingTrackId, "beginCant"],
            parseFloat(beginCant),
          ]],
          [MessageCode.FROM_CLIENT_SET_PROP, [
            ["tracks", tracksSubMenuState.editingTrackId, "endCant"],
            parseFloat(endCant),
          ]],
        ];

        const editingTrackId = tracksSubMenuState.editingTrackId;
        Object.keys(store.data.tracks).forEach(trackId => {
          const track = store.data.tracks[trackId];
          const switches = store.data.switches;
          if (track.idOfTrackOrSwitchConnectedFromStart) {
            if (track.connectedFromStartIsTrack) {
              if (track.idOfTrackOrSwitchConnectedFromStart === editingTrackId) {
                if (track.connectedFromStartIsToEnd) {
                  if (!isNaN(parseFloat(endCant)))
                    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                      ["tracks", trackId, "beginCant"],
                      parseFloat(endCant),
                    ]]);
                } else if (!isNaN(parseFloat(beginCant)))
                  messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                    ["tracks", trackId, "beginCant"],
                    -parseFloat(beginCant),
                  ]]);
              }
            } else {
              const railroadSwitch = switches[track.idOfTrackOrSwitchConnectedFromStart];
              const connectedTrackId = railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected];
              if (connectedTrackId === editingTrackId) {
                if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
                  if (!isNaN(parseFloat(endCant)))
                    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                      ["tracks", trackId, "beginCant"],
                      parseFloat(endCant),
                    ]]);
                } else if (!isNaN(parseFloat(beginCant)))
                  messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                    ["tracks", trackId, "beginCant"],
                    -parseFloat(beginCant),
                  ]]);
              }
            }
          }
          if (track.idOfTrackOrSwitchConnectedFromEnd) {
            if (track.connectedFromEndIsTrack) {
              if (track.idOfTrackOrSwitchConnectedFromEnd === editingTrackId) {
                if (track.connectedFromEndIsToEnd) {
                  if (!isNaN(parseFloat(endCant)))
                    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                      ["tracks", trackId, "endCant"],
                      -parseFloat(endCant),
                    ]]);
                } else if (!isNaN(parseFloat(beginCant)))
                  messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                    ["tracks", trackId, "endCant"],
                    parseFloat(beginCant),
                  ]]);
              }
            } else {
              const railroadSwitch = switches[track.idOfTrackOrSwitchConnectedFromEnd];
              const connectedTrackId = railroadSwitch.connectedTrackIds[railroadSwitch.currentConnected];
              if (connectedTrackId === editingTrackId) {
                if (railroadSwitch.isConnectedToEnd[railroadSwitch.currentConnected]) {
                  if (!isNaN(parseFloat(endCant)))
                    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                      ["tracks", trackId, "endCant"],
                      -parseFloat(endCant),
                    ]]);
                } else if (!isNaN(parseFloat(beginCant)))
                  messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
                    ["tracks", trackId, "endCant"],
                    parseFloat(beginCant),
                  ]]);
              }
            }
          }
        });

        send(socket, MessageCode.FROM_CLIENT_MESSAGES, messages);
      }}>
      Save
    </Button>
  </Stack>;
}

function OffsetTrackMenu() {
  const {
    offsetDistance,
    vehicleOffsetConstant,
    transitionLength1,
    transitionLength2,
    curveRadius,
  } = useSnapshot(offsetTrackState, { sync: true });
  const { selectedTrackIds } = useSnapshot(tracksState, { sync: true });

  const updatePreview = (offsetDist?: string, vehicleConst?: string) => {
    const dist = parseFloat(offsetDist ?? offsetDistance);
    const constVal = parseFloat(vehicleConst ?? vehicleOffsetConstant);
    
    if (isNaN(dist) || isNaN(constVal)) {
      offsetTrackState.previewTracks = [];
      return;
    }

    // storeから直接selectedTrackIdsを取得
    const trackIds = [...tracksState.selectedTrackIds];
    
    if (trackIds.length === 0) {
      offsetTrackState.previewTracks = [];
      return;
    }

    const selectedTracks = trackIds.map(id => store.data.tracks[id]).filter(t => t !== undefined);

    if (selectedTracks.length === 0) {
      offsetTrackState.previewTracks = [];
      return;
    }

    // Create offset tracks for preview
    const offsetTracks = offsetTrackRoute(
      trackIds,
      dist,
      constVal,
      selectedTracks[0]?.trackModels || []
    );

    offsetTrackState.previewTracks = offsetTracks;
  };

  // 初期プレビューを表示
  React.useEffect(() => {
    updatePreview();
  }, []);

  return <Stack direction={'column'} spacing={1}>
    <Button variant='outlined' onClick={() => {
      tracksSubMenuState.isOffsetting = false;
      offsetTrackState.previewTracks = [];
    }}>
      <ArrowBackIcon />
    </Button>
    <TextField
      label="Offset distance (m)"
      value={offsetDistance}
      size="small"
      type="number"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        offsetTrackState.offsetDistance = newValue;
        updatePreview(newValue);
      }}
    />
    <TextField
      label="Vehicle offset constant"
      value={vehicleOffsetConstant}
      size="small"
      type="number"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        offsetTrackState.vehicleOffsetConstant = newValue;
        updatePreview(undefined, newValue);
      }}
    />
    <TextField
      label="Transition length 1 (m)"
      value={transitionLength1}
      size="small"
      type="number"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => offsetTrackState.transitionLength1 = event.target.value}
    />
    <TextField
      label="Transition length 2 (m)"
      value={transitionLength2}
      size="small"
      type="number"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => offsetTrackState.transitionLength2 = event.target.value}
    />
    <TextField
      label="Curve radius (m)"
      value={curveRadius}
      size="small"
      type="number"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => offsetTrackState.curveRadius = event.target.value}
    />
    <Button variant="contained" startIcon={<SaveIcon />}
      disabled={
        isNaN(parseFloat(offsetDistance)) ||
        isNaN(parseFloat(vehicleOffsetConstant)) ||
        isNaN(parseFloat(transitionLength1)) ||
        isNaN(parseFloat(transitionLength2)) ||
        isNaN(parseFloat(curveRadius))
      }
      onClick={() => {
        const offsetDist = parseFloat(offsetDistance);
        const vehicleConst = parseFloat(vehicleOffsetConstant);
        const transLen1 = parseFloat(transitionLength1);
        const transLen2 = parseFloat(transitionLength2);
        const curveRad = parseFloat(curveRadius);

        if (
          isNaN(offsetDist) ||
          isNaN(vehicleConst) ||
          isNaN(transLen1) ||
          isNaN(transLen2) ||
          isNaN(curveRad)
        ) return;

        const selectedTracks = getSelectedTracks();
        const trackIds = tracksState.selectedTrackIds;

        // Create offset tracks
        const offsetTracks = offsetTrackRoute(
          trackIds,
          offsetDist,
          vehicleConst,
          selectedTracks[0]?.trackModels || []
        );

        // Add the offset tracks to the store
        const messages: [MessageCode.FROM_CLIENT_SET_PROP, [Path<SerializableORSAppDataType>, PathValue<SerializableORSAppDataType, Path<SerializableORSAppDataType>>, Path<SerializableORSAppDataType>?]][] = [];

        offsetTracks.forEach((offsetTrack, index) => {
          const newTrackId = uuidv4();
          messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
            ["tracks", newTrackId],
            offsetTrack,
          ]]);
        });

        send(socket, MessageCode.FROM_CLIENT_MESSAGES, messages);
        tracksSubMenuState.isOffsetting = false;
        offsetTrackState.previewTracks = [];
      }}>
      Create offset tracks
    </Button>
  </Stack>;
}
