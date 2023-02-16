import * as React from 'react';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/system';
import Canvas from './Canvas';
import Toolbar from './Toolbar';

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
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }}>
        <Canvas />
      </Box_>
      <Box_ sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        pointerEvents: 'none'
      }}>
        <Box_ sx={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <Toolbar />
        </Box_>
      </Box_>
    </>
  )
}
