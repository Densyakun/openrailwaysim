import { useSnapshot } from 'valtio';
import { Button, FormControlLabel, FormGroup, Paper, Stack, Switch } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeselectIcon from '@mui/icons-material/Deselect';
import { socket } from '../Client';
import { terrainsState } from '@/lib/client/terrains';
import { MessageCode, send } from '@/lib/ws';

export default function TerrainsTabPanel() {
  const { isVisible, selectedTileX, selectedTileY } = useSnapshot(terrainsState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      <FormGroup>
        <FormControlLabel control={<Switch checked={isVisible} onChange={e => terrainsState.isVisible = e.target.checked} />} label="Visible" />
      </FormGroup>
      {selectedTileX !== -1 && <>
        <div>Selected: {selectedTileX}, {selectedTileY}</div>
        <Button variant='contained' startIcon={<DeselectIcon />} onClick={() => {
          terrainsState.selectedTileX = -1;
          terrainsState.selectedTileY = -1;
        }}>
          Deselect
        </Button>
        <Button variant='contained' startIcon={<DeleteIcon />} onClick={() => {
          send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["terrains", terrainsState.selectedTileY.toString(), terrainsState.selectedTileX.toString()]);
          terrainsState.selectedTileX = -1;
          terrainsState.selectedTileY = -1;
        }}>
          Delete
        </Button>
      </>}
    </Stack>
  </Paper>;
}
