import * as React from 'react';
import Box from '@mui/material/Box';
import Canvas from './Canvas';
import Toolbar from './Toolbar';

export default function Container() {
  return (
    <>
      <Box sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }}>
        <Canvas />
      </Box>
      <Box sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        pointerEvents: 'none'
      }}>
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <Toolbar />
        </Box>
      </Box>
    </>
  )
}
