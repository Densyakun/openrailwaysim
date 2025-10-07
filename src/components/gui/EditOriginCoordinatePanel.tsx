import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceIcon from '@mui/icons-material/Place';
import SaveIcon from '@mui/icons-material/Save';
import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { proxy, useSnapshot } from 'valtio';
import { featureCollectionsTabPanelState } from './FeatureCollectionsTabPanel';
import { socket } from '../Client';
import { FROM_CLIENT_SET_PROP } from '@/lib/game';
import { useEffect } from 'react';

const formState = proxy<{
  lon: string;
  lat: string;
}>({
  lon: String(0),
  lat: String(0),
});

export default function EditOriginCoordinatePanel() {
  const { lon: formLon, lat: formLat } = useSnapshot(formState, { sync: true });
  const { lon, lat } = useSnapshot(featureCollectionsTabPanelState);

  useEffect(() => {
    formState.lon = lon.toString();
    formState.lat = lat.toString();
  }, [lon, lat]);

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
      <Stack spacing={1} direction={'row'} alignItems={'center'}>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
          featureCollectionsTabPanelState.isEditingOriginCoordinate = false
        }>
          Back
        </Button>
        <PlaceIcon />
        <Typography variant="h5" gutterBottom>
          Edit a origin coordinate
        </Typography>
      </Stack>

      <TextField
        label="Lon"
        value={formLon}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.lon = event.target.value;
          const value = parseFloat(event.target.value);
          if (Number.isNaN(value)) return;

          featureCollectionsTabPanelState.lon = value;
        }}
      />
      <TextField
        label="Lat"
        value={formLat}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.lat = event.target.value;
          const value = parseFloat(event.target.value);
          if (Number.isNaN(value)) return;

          featureCollectionsTabPanelState.lat = value;
        }}
      />
      <Button variant="contained" startIcon={<SaveIcon />}
        onClick={() =>
          socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
            ["originCoordinate"],
            { value: [featureCollectionsTabPanelState.lon, featureCollectionsTabPanelState.lat] },
          ]]))
        }>
        Save
      </Button>
    </Stack>
  </Paper>;
}
