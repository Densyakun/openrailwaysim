import { useSnapshot } from 'valtio';
import { SerializableTrain } from '@/lib/trains';
import MasterController from './MasterController';
import Speed from './Speed';
import { Box, Button, Stack, SxProps } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { socket } from '../Client';
import { FROM_CLIENT_SET_PROP, toSerializableSaveData, trainTypeId } from '@/lib/game';
import { gameState } from '@/lib/client';
import Reverser from './Reverser';
import { trainsState } from '@/lib/client/trains';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element;

export default function ControlStand() {
  const data = useSnapshot(gameState.data);
  useSnapshot(trainsState);

  if (!trainsState.activeTrainId) return null;

  const train = data.trains[trainsState.activeTrainId];
  if (!train) return null;

  const controlStand = trainsState.activeBodyIndex < train.bogies.length
    ? null
    : train.otherBodies[trainsState.activeBodyIndex - train.bogies.length].controlStand;

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
          <Reverser controlStand={controlStand} />
          <MasterController controlStand={controlStand} />
        </>}
        <Speed />
        <Button variant='contained' startIcon={<CloseIcon />} onClick={() => {
          trainsState.activeBodyIndex = -1
          trainsState.activeTrainId = ""
        }}>
          Back
        </Button>
        <Button variant='contained' onClick={() => {
          gameState.data.trains[trainsState.activeTrainId].speed = -16
          socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
            ["trains", trainsState.activeTrainId],
            toSerializableSaveData(
              trainTypeId,
              gameState.data.trains[trainsState.activeTrainId]
            ) as SerializableTrain]]))
        }}>
          {`<`}
        </Button>
        <Button variant='contained' onClick={() => {
          gameState.data.trains[trainsState.activeTrainId].speed = 0
          socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
            ["trains", trainsState.activeTrainId],
            toSerializableSaveData(
              trainTypeId,
              gameState.data.trains[trainsState.activeTrainId]
            ) as SerializableTrain]]))
        }}>
          {`o`}
        </Button>
        <Button variant='contained' onClick={() => {
          gameState.data.trains[trainsState.activeTrainId].speed = 16
          socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
            ["trains", trainsState.activeTrainId],
            toSerializableSaveData(
              trainTypeId,
              gameState.data.trains[trainsState.activeTrainId]
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