import * as React from 'react';
import { Paper } from '@mui/material';
import { useSnapshot } from 'valtio';
import { state as trainsState } from '@/lib/trains';

export default function Speed() {
  useSnapshot(trainsState);

  const train = trainsState.trains[trainsState.activeTrainIndex];

  return (
    <Paper>
      {(train.speed * 3.6).toFixed(1).padStart(5, '0') + " km/h"}
    </Paper>
  );
}