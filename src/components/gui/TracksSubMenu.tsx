import { proxy, useSnapshot } from 'valtio';
import { Button, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { gameState } from '@/lib/client';
import { getSelectedTracks, TrackModel } from '@/lib/tracks';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_OBJECT, FROM_CLIENT_SET_PROP } from '@/lib/game';
import CurveEditMenu, { curveEditMenuState } from './CurveEditMenu';
import { tracksState } from '@/lib/client/tracks';
import React from 'react';

export const tracksSubMenuState = proxy<{
  isAddingCurve: boolean;
  hoveredAddingTracks: number;
  isEditingModels: boolean;
  trackModels: {
    modelPath: string;
    start: string;
    end: string;
    span: string;
    interval: string;
  }[];
}>({
  isAddingCurve: false,
  hoveredAddingTracks: -1,
  isEditingModels: false,
  trackModels: [],
});

function TrackModelSettings() {
  const { trackModels } = useSnapshot(tracksSubMenuState, { sync: true });

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
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
            interval: "0",
            span: "0",
          })}>
            <AddIcon />
          </IconButton>
        </Stack>
        <TableContainer component={Paper} sx={{ height: "52.4px", overflow: "scroll" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell align="right">Path</TableCell>
                <TableCell align="right">Start</TableCell>
                <TableCell align="right">End</TableCell>
                <TableCell align="right">Span</TableCell>
                <TableCell align="right">Interval</TableCell>
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
                    value={trackModel.modelPath}
                    size="small"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      tracksSubMenuState.trackModels[index].modelPath = event.target.value
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    value={trackModel.start}
                    size="small"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      tracksSubMenuState.trackModels[index].start = event.target.value
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    value={trackModel.end}
                    size="small"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      tracksSubMenuState.trackModels[index].end = event.target.value
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    value={trackModel.span}
                    size="small"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      tracksSubMenuState.trackModels[index].span = event.target.value
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    value={trackModel.interval}
                    size="small"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      tracksSubMenuState.trackModels[index].interval = event.target.value
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
            socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
              ["tracks", trackId, "trackModels"],
              tracksSubMenuState.trackModels.map(trackModel => {
                const trackModel_: TrackModel = {
                  modelPath: trackModel.modelPath,
                  start: parseFloat(trackModel.start),
                  end: parseFloat(trackModel.end),
                  span: parseFloat(trackModel.span),
                  interval: parseFloat(trackModel.interval),
                };

                return trackModel_;
              })
            ]]));
          });
        }}>
        Save
      </Button>
    </Stack>
  </Paper>;
}

export default function TracksSubMenu() {
  const { isEditingModels } = useSnapshot(tracksSubMenuState);

  return isEditingModels
    ? <TrackModelSettings />
    : <MainMenu />;
}

function MainMenu() {
  const { selectedTrackIds } = useSnapshot(tracksState);
  useSnapshot(tracksSubMenuState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      {tracksSubMenuState.isAddingCurve ? <>
        <Button variant='outlined' onClick={() => {
          tracksSubMenuState.isAddingCurve = false;
          curveEditMenuState.addingCurves.splice(0);
          curveEditMenuState.addingTransitionsAB.splice(0);
          curveEditMenuState.addingTransitionsCD.splice(0);
        }}>
          <ArrowBackIcon />
        </Button>
        <CurveEditMenu />
      </>
        : <>
          <div>Selected: {selectedTrackIds.length}</div>
          <Button variant='contained' disabled={!selectedTrackIds.length} onClick={() => {
            tracksState.selectedTrackIds.splice(0, tracksState.selectedTrackIds.length);
          }}>
            Deselect tracks
          </Button>
          <Button variant='contained' startIcon={<DeleteIcon />} disabled={!selectedTrackIds.length} onClick={() =>
            tracksState.selectedTrackIds.forEach(trackId =>
              socket.send(JSON.stringify([FROM_CLIENT_DELETE_OBJECT, ["tracks", trackId]]))
            )
          }>
            Delete tracks
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
              socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
                ["tracks", trackId, "trackModels"],
                [{
                  modelPath: "https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-1067.gltf",
                  start: 0,
                  end: -1,
                }]
              ]]));
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
              span: trackModel.span.toString(),
              interval: trackModel.interval.toString(),
            }));
          }}>
            Model settings
          </Button>
        </>}
    </Stack>
  </Paper>;
}