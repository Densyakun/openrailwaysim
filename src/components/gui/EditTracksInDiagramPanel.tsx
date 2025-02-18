import { proxy, useSnapshot } from 'valtio';
import { Alert, Button, ButtonGroup, Paper, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { gameState } from '@/lib/client';
import { getPosition, selectConnectedTracks } from '@/lib/tracks';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';
import { diagramsTabPanelState } from '@/lib/client/diagrams';
import { tracksState } from '@/lib/client/tracks';
import { gisState, move } from '@/lib/gis';

export const editTracksInDiagramState = proxy<{
  nextTrackIds: string[];
  focusedNextTrackIndex: number;
}>({
  nextTrackIds: [],
  focusedNextTrackIndex: -1,
});

export function onUpdateTrackList() {
  if (!diagramsTabPanelState.routeMap.length || diagramsTabPanelState.selectingRouteIndex < 0) return;

  const trackIds = diagramsTabPanelState.routeMap[diagramsTabPanelState.selectingRoutesIndex][diagramsTabPanelState.selectingRouteIndex].trackIds;
  if (!trackIds.length) return;

  // 接続された軌道の一覧を取得する
  const lastTrackId = trackIds[trackIds.length - 1];
  const track = gameState.data.tracks[lastTrackId];

  editTracksInDiagramState.nextTrackIds = selectConnectedTracks(
    gameState.data,
    track,
    trackIds,
  );

  if (editTracksInDiagramState.focusedNextTrackIndex === -1 || editTracksInDiagramState.nextTrackIds.length <= editTracksInDiagramState.focusedNextTrackIndex)
    editTracksInDiagramState.focusedNextTrackIndex = 0;
  focusingNextSegmentIndex();
}

function focusingNextSegmentIndex() {
  if (!editTracksInDiagramState.nextTrackIds.length) return;

  const nextTrackId = editTracksInDiagramState.nextTrackIds[editTracksInDiagramState.focusedNextTrackIndex];
  const nextTrack = gameState.data.tracks[nextTrackId];

  setCameraTargetPosition(
    nextTrack.centerCoordinate,
    0
  );
  const position = getPosition(nextTrack, nextTrack.length / 2);
  move(gisState.originTransform.quaternion, position.x, position.z);
}

export default function EditTracksInDiagramPanel() {
  const {
    routeMap,
    selectingRoutesIndex,
    selectingRouteIndex,
  } = useSnapshot(diagramsTabPanelState);
  const {
    focusedNextTrackIndex,
    nextTrackIds,
  } = useSnapshot(editTracksInDiagramState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <div>Edit track selections</div>
        <Button variant='outlined' onClick={() => {
          diagramsTabPanelState.tracksIsEditing = false;
          tracksState.pointingOnTrack = undefined;
        }}>
          Back
        </Button>
      </Stack>
      {routeMap[selectingRoutesIndex][selectingRouteIndex].trackIds.length
        ? <Paper>
          <Stack spacing={1}>
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
                diagramsTabPanelState.routeMap[diagramsTabPanelState.selectingRoutesIndex][diagramsTabPanelState.selectingRouteIndex].trackIds.push(nextTrackIds[focusedNextTrackIndex]);
                onUpdateTrackList();
              }}>
                Add
              </Button>
            </Stack>
          </Stack>
        </Paper>
        : <Alert severity="error">
          軌道を選択して追加してください
        </Alert>
      }
    </Stack>
  </Paper>;
}
