import * as React from 'react';
import { useSnapshot } from 'valtio';
import { state as trainsState } from '@/lib/trains';
import MasterController from './MasterController';
import Speed from './Speed';

export default function ControlStand() {
  useSnapshot(trainsState);

  if (!trainsState.activeTrainId) return null;

  return (
    <>
      <MasterController />
      <Speed />
    </>
  );
}