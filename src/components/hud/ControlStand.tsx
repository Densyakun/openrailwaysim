import { useSnapshot } from 'valtio';
import { SerializableTrain, trainsState as trainsState } from '@/lib/trains';
import MasterController from './MasterController';
import Speed from './Speed';
import { Box, Button, Stack, SxProps } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game';
import { gameState } from '@/lib/client';
import Reverser from './Reverser';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element;

export default function ControlStand() {
  useSnapshot(gameState);
  useSnapshot(trainsState);

  if (!trainsState.activeTrainId) return null;

  const train = gameState.trains[trainsState.activeTrainId];
  if (!train) return null;

  const { controlStands } = trainsState.activeBodyIndex < train.bogies.length ? train.bogies[trainsState.activeBodyIndex] : train.otherBodies[trainsState.activeBodyIndex - train.bogies.length];
  // TODO 複数の運転台に対応する
  const controlStandIndex = 0;
  const controlStand = controlStands[controlStandIndex];

  return <Stack
    direction="row"
    alignItems="flex-end"
    spacing={1}
    sx={{
      width: "100%",
      height: "100%",
    }}
  >
    <Box_ sx={{
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
    }}>
      <Box_ sx={{
        display: "contents",
        alignItems: 'flex-end',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}>
        {controlStand && <>
          <Reverser controlStandIndex={controlStandIndex} controlStand={controlStand} />
          <MasterController controlStandIndex={controlStandIndex} controlStand={controlStand} />
        </>}
        <Speed />
        <Button variant='contained' startIcon={<CloseIcon />} onClick={() => {
          trainsState.activeBodyIndex = -1
          trainsState.activeTrainId = ""
        }}>
          Back
        </Button>
        <Button variant='contained' onClick={() => {
          gameState.trains[trainsState.activeTrainId].speed = -16
          socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["trains", toSerializableProp(
            ["trains", trainsState.activeTrainId],
            gameState.trains[trainsState.activeTrainId]
          ) as SerializableTrain]]))
        }}>
          {`<`}
        </Button>
        <Button variant='contained' onClick={() => {
          gameState.trains[trainsState.activeTrainId].speed = 0
          socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["trains", toSerializableProp(
            ["trains", trainsState.activeTrainId],
            gameState.trains[trainsState.activeTrainId]
          ) as SerializableTrain]]))
        }}>
          {`o`}
        </Button>
        <Button variant='contained' onClick={() => {
          gameState.trains[trainsState.activeTrainId].speed = 16
          socket.send(JSON.stringify([FROM_CLIENT_SET_OBJECT, ["trains", toSerializableProp(
            ["trains", trainsState.activeTrainId],
            gameState.trains[trainsState.activeTrainId]
          ) as SerializableTrain]]))
        }}>
          {`>`}
        </Button>
      </Box_>
    </Box_>
    <Box_ sx={{
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: 'center',
      alignItems: 'flex-end',
    }}>
    </Box_>
    <Box_ sx={{
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    }}>
    </Box_>
  </Stack>;
}