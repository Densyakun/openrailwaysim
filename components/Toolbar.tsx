import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import MuiToolbar from '@mui/material/Toolbar';
import MapCameraSwitch from './MapCameraSwitch';

export default function Toolbar() {
  return (
    <AppBar position="static" sx={{ backgroundColor: "#00000080" }}>
      <MuiToolbar>
        <MapCameraSwitch />
      </MuiToolbar>
    </AppBar>
  );
}