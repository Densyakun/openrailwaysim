import { proxy, useSnapshot } from 'valtio';
import { Button, Paper, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import { gameState } from '@/lib/client';
import { areParallel, getSelectedTracks, tracksState } from '@/lib/tracks';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_OBJECT, FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game';
import CurveEditMenu, { curveEditMenuState } from './CurveEditMenu';

export const tracksSubMenuState = proxy<{
  isAddingCurve: boolean;
  hoveredAddingTracks: number;
}>({
  isAddingCurve: false,
  hoveredAddingTracks: -1,
});

export default function TracksSubMenu() {
  useSnapshot(tracksState);
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
          <Button variant='contained' disabled={!tracksState.selectedTrackIds.length} onClick={() => {
            tracksState.selectedTrackIds.splice(0, tracksState.selectedTrackIds.length);
          }}>
            Deselect tracks
          </Button>
          <Button variant='contained' startIcon={<DeleteIcon />} disabled={!tracksState.selectedTrackIds.length} onClick={() =>
            tracksState.selectedTrackIds.forEach(trackId =>
              socket.send(JSON.stringify([FROM_CLIENT_DELETE_OBJECT, ["tracks", trackId]]))
            )
          }>
            Delete tracks
          </Button>
          <Button variant='contained' disabled={tracksState.selectedTrackIds.length !== 2} onClick={() => {
            const tracks = getSelectedTracks(gameState);

            // 平行の場合
            if (areParallel(tracks[0], tracks[1])) return;

            curveEditMenuState.AB = tracks[0];
            curveEditMenuState.CD = tracks[1];
            tracksSubMenuState.isAddingCurve = true;
          }}>
            Create new curve
          </Button>
          <Button variant='contained' disabled={!tracksState.selectedTrackIds.length} onClick={() =>
            tracksState.selectedTrackIds.forEach(trackId => {
              gameState.tracks[trackId].modelPaths = ["https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50n-1067.gltf"];
              socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["tracks", toSerializableProp(["tracks", trackId], gameState.tracks[trackId])]]));
            })
          }>
            Test model
          </Button>
        </>}
    </Stack>
  </Paper>;
}