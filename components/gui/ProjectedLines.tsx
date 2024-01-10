import { gameState } from '@/lib/client';
import RouteIcon from '@mui/icons-material/Route';
import * as React from 'react';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { Stack, Typography } from '@mui/material';

export default function ProjectedLines() {
  useSnapshot(gameState);

  return <DataMenu
    titleElement={(adding: boolean, editingId: string) => (
      <Stack spacing={1} direction={'row'} alignItems={'center'}>
        <RouteIcon />
        <Typography variant="h5" gutterBottom>Projected lines</Typography>
      </Stack>
    )}
    objectKey="projectedLines"
    objects={gameState.projectedLines}
  />
}
