import * as React from 'react';
import { useSnapshot } from 'valtio';
import { state as trainsState } from '@/lib/trains';
import MasterController from './MasterController';

export default function ControlStand() {
  useSnapshot(trainsState);

  return (
    <>
      {trainsState.activeTrainIndex !== -1 && <MasterController />}
    </>
  );
}