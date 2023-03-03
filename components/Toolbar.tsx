import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import MuiToolbar from '@mui/material/Toolbar';
import CameraSwitch from './cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from './cameras-and-controls/CameraControlsSwitch';
import { state as dateState } from '@/lib/date';
import { useSnapshot } from 'valtio';

export default function Toolbar() {
  const snap = useSnapshot(dateState);

  const date = new Date(snap.nowDate);

  return (
    <AppBar position="static" sx={{ backgroundColor: "#00000080" }}>
      <MuiToolbar>
        <Stack
          direction="row"
          divider={<Divider orientation="vertical" flexItem />}
          spacing={1}
          overflow={'auto'}
        >
          <p style={{ textAlign: "center", whiteSpace: "nowrap" }}>
            {`${date.getUTCFullYear()}/${("00" + (date.getUTCMonth() + 1)).slice(-2)}/${("00" + date.getUTCDate()).slice(-2)} ${("00" + date.getUTCHours()).slice(-2)}:${("00" + date.getUTCMinutes()).slice(-2)}:${("00" + date.getUTCSeconds()).slice(-2)} GMT`}
          </p>
          <CameraSwitch />
          <CameraControlsSwitch />
        </Stack>
      </MuiToolbar>
    </AppBar>
  );
}