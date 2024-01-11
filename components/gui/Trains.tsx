import { gameState } from '@/lib/client';
import PlaceIcon from '@mui/icons-material/Place';
import TrainIcon from '@mui/icons-material/Train';
import * as React from 'react';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';
import { eulerToCoordinate, move, state as gisState } from '@/lib/gis';

export default function Trains() {
  useSnapshot(gameState);

  return <DataMenu
    titleElement={(adding: boolean, editingId: string) => (
      <Stack spacing={1} direction={'row'} alignItems={'center'}>
        <TrainIcon />
        <Typography variant="h5" gutterBottom>Trains</Typography>
      </Stack>
    )}
    objectKey="trains"
    objects={gameState.trains}
    listItemButtons={id =>
      <Tooltip title="Move camera to object" disableInteractive>
        <IconButton edge="end" onClick={() => {
          const train = gameState.trains[id]

          const targetCoordinate = eulerToCoordinate(train.globalPosition)
          const position = train.bogies[0].axles[0].position
          setCameraTargetPosition(targetCoordinate, position.y)
          move(gisState.originTransform.quaternion, position.x, position.z)
        }}>
          <PlaceIcon />
        </IconButton>
      </Tooltip>
    }
  />
}
