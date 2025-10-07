import * as React from 'react';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSnapshot } from 'valtio';
import { camerasState } from './Cameras';

export default function CameraSwitch() {
  const { mainCameraKey } = useSnapshot(camerasState);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    camerasState.mainCameraKey = event.target.checked
      ? "orthographicCamera"
      : "perspectiveCamera"
      ;
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography style={{ whiteSpace: "nowrap" }}>Projection: Pers</Typography>
      <Switch
        checked={mainCameraKey === "orthographicCamera"}
        onChange={handleChange}
      />
      <Typography style={{ whiteSpace: "nowrap" }}>Ortho</Typography>
    </Stack>
  );
}
