import { gameState } from '@/lib/client';
import TrainIcon from '@mui/icons-material/Train';
import * as React from 'react';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { Stack, Typography } from '@mui/material';

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
  />
}
