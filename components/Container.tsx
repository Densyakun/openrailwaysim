import * as React from 'react';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/system';
import Canvas from './Canvas';
import { Stack } from '@mui/material';
import GUI from './gui/GUI';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element

export default function Container() {
  return (
    <>
      <Box_ sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: '100%',
      }}>
        <Canvas />
      </Box_>

      <Stack
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          overflow: 'clip',
          pointerEvents: 'none',
        }}
      >
        <GUI />
      </Stack>
    </>
  )
}
