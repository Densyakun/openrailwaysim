import { proxy, useSnapshot } from 'valtio';
import { Alert, Button, ButtonGroup, Paper, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { getPosition, Track } from '@/lib/tracks';
import { diagramsTabPanelState } from '@/lib/client/diagrams';
import { tracksState } from "@/lib/client/tracks/store";
import { setCameraTargetPosition } from '@/lib/client/camera';
import { store } from '@/lib/game';

export const editTracksInDiagramState = proxy<{
  nextTrackIds: string[];
  focusedNextTrackIndex: number;
}>({
  nextTrackIds: [],
  focusedNextTrackIndex: -1,
});

/**
 * track と接続され excludedTrackIds に含まない軌道のID配列を返す。リスト内のセグメントは重複しない。
 * @param track 対象の軌道
 * @param excludedTrackIds 除外する軌道のID配列
 */
export function getConnectedTracks(track: Track, excludedTrackIds: string[]) {
  const syncData = store.data;
  const connectedTracks: string[] = [];

  if (track.idOfTrackOrSwitchConnectedFromStart)
    if (track.connectedFromStartIsTrack) {
      if (!excludedTrackIds.includes(track.idOfTrackOrSwitchConnectedFromStart))
        connectedTracks.push(track.idOfTrackOrSwitchConnectedFromStart);
    } else {
      const railroadSwitch = syncData.switches[track.idOfTrackOrSwitchConnectedFromStart];
      railroadSwitch.connectedTrackIds.forEach(trackId => {
        if (!excludedTrackIds.includes(trackId))
          connectedTracks.push(trackId);
      });
    }
  if (track.idOfTrackOrSwitchConnectedFromEnd)
    if (track.connectedFromEndIsTrack) {
      if (!excludedTrackIds.includes(track.idOfTrackOrSwitchConnectedFromEnd))
        connectedTracks.push(track.idOfTrackOrSwitchConnectedFromEnd);
    } else {
      const railroadSwitch = syncData.switches[track.idOfTrackOrSwitchConnectedFromEnd];
      railroadSwitch.connectedTrackIds.forEach(trackId => {
        if (!excludedTrackIds.includes(trackId))
          connectedTracks.push(trackId);
      });
    }

  return connectedTracks;
}

export function onUpdateTrackList() {
  if (!diagramsTabPanelState.sections.length || diagramsTabPanelState.selectingRouteIndex < 0) return;

  const trackIds = diagramsTabPanelState.sections[diagramsTabPanelState.selectingDiagramSectionIndex].routes[diagramsTabPanelState.selectingRouteIndex].trackIds;
  if (!trackIds.length) return;

  // 接続された軌道の一覧を取得する
  const lastTrackId = trackIds[trackIds.length - 1];
  const track = store.data.tracks[lastTrackId];

  editTracksInDiagramState.nextTrackIds = getConnectedTracks(
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
  const nextTrack = store.data.tracks[nextTrackId];

  setCameraTargetPosition(getPosition(nextTrack, nextTrack.length / 2));
}

export default function EditTracksInDiagramPanel() {
  const {
    sections,
    selectingDiagramSectionIndex,
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
      {sections[selectingDiagramSectionIndex].routes[selectingRouteIndex].trackIds.length
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
                diagramsTabPanelState.sections[diagramsTabPanelState.selectingDiagramSectionIndex].routes[diagramsTabPanelState.selectingRouteIndex].trackIds.push(nextTrackIds[focusedNextTrackIndex]);
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
