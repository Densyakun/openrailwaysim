import * as React from 'react';
import { Paper } from '@mui/material';
import { useSnapshot } from 'valtio';
import { state as trainsState } from '@/lib/trains';
import { gameState } from '@/lib/client';

export default function Speed() {
  useSnapshot(gameState);

  const train = gameState.trains[trainsState.activeTrainId];

  return (
    <Paper>
      {(train.speed * 3.6).toFixed(1).padStart(5, '0') + " km/h"}
    </Paper>
  );
}