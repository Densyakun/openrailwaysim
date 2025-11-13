import { proxy, useSnapshot } from 'valtio';
import { Button, Checkbox, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import DeselectIcon from '@mui/icons-material/Deselect';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { gameState } from '@/lib/client/client';
import { getSelectedTracks, TrackModel } from '@/lib/tracks';
import { socket } from '../Client';
import CurveEditMenu from './CurveEditMenu';
import { tracksState } from '@/lib/client/tracks';
import React from 'react';
import { MessageCode, send } from '@/lib/ws';
import { curveEditMenuState } from '@/lib/client/curveEditMenu';
import { Path, PathValue, SerializableSaveDataType } from '@/lib/game';

export const tracksSubMenuState = proxy<{
  isAddingCurve: boolean;
  hoveredAddingTracks: number;
  isEditingModels: boolean;
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
}>({
  isAddingCurve: false,
  hoveredAddingTracks: -1,
  isEditingModels: false,
  trackModels: [],
  editingTrackId: "",
  beginCant: "",
  endCant: "",
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
  const { isEditingModels, isAddingCurve, editingTrackId } = useSnapshot(tracksSubMenuState);

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
      const track = gameState.data.tracks[tracksSubMenuState.editingTrackId = selectedTrackIds[0]];
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
      const tracks = getSelectedTracks(gameState.data);

      // 平行の場合
      if (tracks[0].rotationY === tracks[1].rotationY) return;

      curveEditMenuState.AB = tracks[0];
      curveEditMenuState.CD = tracks[1];
      tracksSubMenuState.isAddingCurve = true;
    }}>
      Create new curve
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
      tracksSubMenuState.trackModels = gameState.data.tracks[tracksState.selectedTrackIds[0]].trackModels.map(trackModel => ({
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

        const messages: [MessageCode.FROM_CLIENT_SET_PROP, [Path<SerializableSaveDataType>, PathValue<SerializableSaveDataType, Path<SerializableSaveDataType>>, Path<SerializableSaveDataType>?]][] = [
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
        Object.keys(gameState.data.tracks).forEach(trackId => {
          const track = gameState.data.tracks[trackId];
          const switches = gameState.data.switches;
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
