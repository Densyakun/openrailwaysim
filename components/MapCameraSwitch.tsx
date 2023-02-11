import * as React from 'react';
import FormGroup from '@mui/material/FormGroup';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { proxy } from 'valtio';

export const state = proxy({ showingMapCamera: false });

export default function MapCameraSwitch() {
  const [checked, setChecked] = React.useState(state.showingMapCamera);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked(event.target.checked);
  };

  React.useEffect(() => {
    state.showingMapCamera = checked;
  }, [checked]);

  return (
    <FormGroup>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography>Orbit</Typography>
        <Switch
          checked={checked}
          onChange={handleChange}
        />
        <Typography>Map</Typography>
      </Stack>
    </FormGroup>
  );
}
