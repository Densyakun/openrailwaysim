import { Paper } from '@mui/material';
import { useSnapshot } from 'valtio';
import { trainsState } from '@/lib/client/trains';
import { store } from '@/lib/game';

export default function Speed() {
  const { trains } = useSnapshot(store.syncData);

  const train = trains[trainsState.activeTrainId];

  return (
    <Paper sx={{
      width: "90px"
    }}>
      {Math.abs(train.speed * 3.6).toFixed(1).padStart(5, '0') + " km/h"}
    </Paper>
  );
}