import { gameState } from '@/lib/client';
import PlaceIcon from '@mui/icons-material/Place';
import RouteIcon from '@mui/icons-material/Route';
import * as React from 'react';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';

export default function Tracks() {
  useSnapshot(gameState);

  return <DataMenu
    titleElement={(adding: boolean, editingId: string) => (
      <Stack spacing={1} direction={'row'} alignItems={'center'}>
        <RouteIcon />
        <Typography variant="h5" gutterBottom>Tracks</Typography>
      </Stack>
    )}
    objectKey="tracks"
    objects={gameState.tracks}
    listItemButtons={id =>
      <Tooltip title="Move camera to object" disableInteractive>
        <IconButton edge="end" onClick={() => {
          const track = gameState.tracks[id]

          const targetCoordinate = track.centerCoordinate
          setCameraTargetPosition(targetCoordinate, track.position.y)
        }}>
          <PlaceIcon />
        </IconButton>
      </Tooltip>
    }
  />
}
