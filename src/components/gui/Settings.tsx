import SaveIcon from '@mui/icons-material/Save';
import CameraSwitch from '../cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from '../cameras-and-controls/CameraControlsSwitch';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { socket } from '../Client';
import { FROM_CLIENT_SAVE } from '@/lib/game';
import CameraFarTextField from '../cameras-and-controls/CameraFarTextField';

export default function Settings() {
  return <Paper square sx={{
    width: "100%",
    height: "100%",
    pointerEvents: 'auto',
    userSelect: 'none',
    p: 1,
    overflow: 'auto',
    backgroundColor: '#000b',
  }}>
    <Stack spacing={1}>
      <Typography variant="h5" component="h1">Camera settings</Typography>
      <CameraSwitch />
      <CameraFarTextField />
      <Typography variant="h5" component="h1">Controls settings</Typography>
      <CameraControlsSwitch />
      <Button variant="contained" startIcon={<SaveIcon />} onClick={() => socket.send(JSON.stringify([FROM_CLIENT_SAVE]))}>
        Save world
      </Button>
    </Stack>
  </Paper>;
}
