import * as React from 'react';
import { useSnapshot } from 'valtio';
import { state as trainsState } from '@/lib/trains';
import MasterController from './MasterController';
import Speed from './Speed';
import { Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function ControlStand() {
  useSnapshot(trainsState);

  if (!trainsState.activeTrainId) return null;

  return (
    <>
      <MasterController />
      <Speed />
      <Button variant='contained' startIcon={<CloseIcon />} onClick={() => {
        trainsState.activeBodyIndex = -1
        trainsState.activeTrainId = ""
      }}>
        Back
      </Button>
    </>
  );
}