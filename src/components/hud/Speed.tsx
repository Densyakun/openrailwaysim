import { Paper } from '@mui/material';
import { useSnapshot } from 'valtio';
import { gameState } from '@/lib/client/client';
import { trainsState } from '@/lib/client/trains';

export default function Speed() {
  const data = useSnapshot(gameState.data);

  const train = data.trains[trainsState.activeTrainId];

  return (
    <Paper sx={{
      width: "90px"
    }}>
      {Math.abs(train.speed * 3.6).toFixed(1).padStart(5, '0') + " km/h"}
    </Paper>
  );
}