import { useSnapshot } from 'valtio';
import { Button, Paper, Stack } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeselectIcon from '@mui/icons-material/Deselect';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_PROP } from '@/lib/game';
import { terrainsState } from '@/lib/client/terrains';

export default function TerrainsTabPanel() {
  const { selectedTileX, selectedTileY } = useSnapshot(terrainsState);

  if (selectedTileX === -1) return null;

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      <div>Selected: {selectedTileX}, {selectedTileY}</div>
      <Button variant='contained' startIcon={<DeselectIcon />} onClick={() => {
        terrainsState.selectedTileX = -1;
        terrainsState.selectedTileY = -1;
      }}>
        Deselect
      </Button>
      <Button variant='contained' startIcon={<DeleteIcon />} onClick={() => {
        socket.send(JSON.stringify([FROM_CLIENT_DELETE_PROP, ["terrains", terrainsState.selectedTileY, terrainsState.selectedTileX]]));
        terrainsState.selectedTileX = -1;
        terrainsState.selectedTileY = -1;
      }}>
        Delete
      </Button>
    </Stack>
  </Paper>;
}
