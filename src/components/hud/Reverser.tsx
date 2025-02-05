import { Paper, Slider } from '@mui/material';
import { ControlStandType } from '@/lib/trains';
import { gameState } from '@/lib/client';
import { socket } from '../Client';
import { FROM_CLIENT_SET_PROP } from '@/lib/game';
import { trainsState } from '@/lib/client/trains';

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
  controlStand,
}: {
  controlStand: ControlStandType;
}) {
  return (
    <ReverserSlider
      value={controlStand.reverser}
      setValue={newValue =>
        socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
          [
            "trains",
            trainsState.activeTrainId,
            "otherBodies",
            trainsState.activeBodyIndex - gameState.data.trains[trainsState.activeTrainId].bogies.length,
            "controlStand",
            "reverser"
          ],
          newValue
        ]]))
      }
    />
  );
}