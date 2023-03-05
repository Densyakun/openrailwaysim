import * as React from 'react';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSnapshot } from 'valtio';
import { state } from './CameraControls';

export default function CameraControlsSwitch() {
  const { mainControlsKey } = useSnapshot(state);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    state.mainControlsKey = event.target.checked ? "mapControls" : "orbitControls";
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
