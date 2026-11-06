import * as React from 'react';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSnapshot } from 'valtio';
import { cameraControlsModeState, cameraControlsState } from './CameraControls';

export default function CameraControlsSwitch() {
  const { mainControlsKey } = useSnapshot(cameraControlsModeState);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const key = event.target.checked ? "mapControls" : "orbitControls";
    cameraControlsModeState.mainControlsKey = key;
    cameraControlsState.mainControlsKey = key;
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography style={{ whiteSpace: "nowrap" }}>Controls: Orbit</Typography>
      <Switch
        checked={mainControlsKey === "mapControls"}
        onChange={handleChange}
      />
      <Typography style={{ whiteSpace: "nowrap" }}>Map</Typography>
    </Stack>
  );
}
