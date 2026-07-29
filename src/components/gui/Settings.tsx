import SaveIcon from '@mui/icons-material/Save';
import PersonIcon from '@mui/icons-material/Person';
import CameraSwitch from '../cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from '../cameras-and-controls/CameraControlsSwitch';
import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { socket } from '../Client';
import CameraFarTextField from '../cameras-and-controls/CameraFarTextField';
import { MessageCode, send } from '@/lib/ws';
import { clientState } from '@/lib/client/client';

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
      <Typography variant="h5" component="h1">Connection</Typography>
      <TextField
        label="Username"
        size="small"
        defaultValue={clientState.username}
        onBlur={e => {
          const name = e.target.value.slice(0, 32) || "Anonymous";
          clientState.username = name;
          if (socket && clientState.isAuthenticated) {
            send(socket, MessageCode.FROM_CLIENT_SET_USERNAME, name);
          }
        }}
      />
      <Typography variant="h5" component="h1">Camera settings</Typography>
      <CameraSwitch />
      <CameraFarTextField />
      <Typography variant="h5" component="h1">Controls settings</Typography>
      <CameraControlsSwitch />
      <Button variant="contained" startIcon={<SaveIcon />} onClick={() => send(socket, MessageCode.FROM_CLIENT_SAVE)}>
        Save world
      </Button>
    </Stack>
  </Paper>;
}
