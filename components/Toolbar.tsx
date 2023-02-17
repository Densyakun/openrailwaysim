import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import MuiToolbar from '@mui/material/Toolbar';
import CameraSwitch from './cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from './cameras-and-controls/CameraControlsSwitch';

export default function Toolbar() {
  return (
    <AppBar position="static" sx={{ backgroundColor: "#00000080" }}>
      <MuiToolbar>
        <Stack direction="row" spacing={1}>
          <CameraSwitch />
          <Divider orientation="vertical" flexItem />
          <CameraControlsSwitch />
        </Stack>
      </MuiToolbar>
    </AppBar>
  );
}