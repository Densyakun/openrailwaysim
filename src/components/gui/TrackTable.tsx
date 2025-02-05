import { gameState } from '@/lib/client';
import PlaceIcon from '@mui/icons-material/Place';
import RouteIcon from '@mui/icons-material/Route';
import * as React from 'react';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';

export default function TrackTable() {
  useSnapshot(gameState.data);

  return <DataMenu
    titleElement={(adding: boolean, editingId: string) => (
      <Stack spacing={1} direction={'row'} alignItems={'center'}>
        <RouteIcon />
        <Typography variant="h5" gutterBottom>Tracks</Typography>
      </Stack>
    )}
    objects={gameState.data.tracks}
    listItemButtons={id =>
      <Tooltip title="Move camera to object" disableInteractive>
        <IconButton edge="end" onClick={() => {
          const track = gameState.data.tracks[id]

          const targetCoordinate = track.centerCoordinate
          setCameraTargetPosition(targetCoordinate, track.position.y)
        }}>
          <PlaceIcon />
        </IconButton>
      </Tooltip>
    }
  />
}
