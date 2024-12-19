import * as React from 'react';
import { useSnapshot } from 'valtio';
import { SerializableTrain, state as trainsState } from '@/lib/trains';
import MasterController from './MasterController';
import Speed from './Speed';
import { Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { socket } from '../Client';
import { FROM_CLIENT_SET_OBJECT, toSerializableProp } from '@/lib/game';
import { gameState } from '@/lib/client';
import Reverser from './Reverser';

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

  return (
    <>
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
    </>
  );
}