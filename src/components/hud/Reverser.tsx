import { Paper, Slider } from '@mui/material';
import { socket } from '../Client';
import { trainsState } from '@/lib/client/trains';
import { MessageCode, send } from '@/lib/ws';
import { CabStateType } from '@/lib/trains';
import { store } from '@/lib/game';

export function ReverserSlider({ value, setValue }: { value: number, setValue: (newValue: number) => void }) {
  const handleChange = (event: Event, newValue: number | number[]) => {
    setValue(newValue as number);
  };

  return (
    <Paper sx={{
      height: "80px",
      py: 2,
    }}>
      <Slider
        orientation="vertical"
        marks={[
          {
            value: 1,
            label: "前",
          }, {
            value: 0,
            label: "切",
          }, {
            value: -1,
            label: "後",
          }
        ]}
        max={1}
        min={-1}
        value={value}
        track={false}
        onChange={handleChange}
      />
    </Paper>
  );
}

export default function Reverser({
  cabState,
}: {
  cabState: CabStateType;
}) {
  return (
    <ReverserSlider
      value={cabState.reverser}
      setValue={newValue => {
        const activeTrain = store.data.trains[trainsState.activeTrainId];
        if (activeTrain) {
          const cabIndex = trainsState.activeBodyIndex - activeTrain.bogies.length;
          if (activeTrain.cabStates[cabIndex]) {
            activeTrain.cabStates[cabIndex].reverser = newValue;
          }
        }

        send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
          [
            "trains",
            trainsState.activeTrainId,
            "cabStates",
            trainsState.activeBodyIndex - store.data.trains[trainsState.activeTrainId].bogies.length,
            "reverser"
          ],
          newValue
        ] as any);
      }}
    />
  );
}