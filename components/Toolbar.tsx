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
        <Stack
          direction="row"
          divider={<Divider orientation="vertical" flexItem />}
          spacing={1}
        >
          <CameraSwitch />
          <CameraControlsSwitch />
        </Stack>
      </MuiToolbar>
    </AppBar>
  );
}