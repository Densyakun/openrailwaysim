import * as React from 'react';
import { useSnapshot } from 'valtio';
import { state as trainsState } from '@/lib/trains';
import MasterController from './MasterController';
import Speed from './Speed';
import { Box, SxProps } from '@mui/material';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element;

export default function ControlStand() {
  useSnapshot(trainsState);

  if (!trainsState.activeTrainId) return null;

  return (
    <>
      <MasterController />
      <Box_ sx={{
        position: "relative",
        left: 90,
      }}>
        <Speed />
      </Box_>
    </>
  );
}