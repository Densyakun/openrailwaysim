import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import Grid from '@mui/material/Grid';
import MenuIcon from '@mui/icons-material/Menu';
import { SxProps } from '@mui/system';
import { proxy, useSnapshot } from 'valtio';
import Canvas from './Canvas';
import TimeChip from './TimeChip';
import Admin from './admin/App';

export const state = proxy<{
  isOpen: boolean;
}>({
  isOpen: false,
});

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element

export default function Container() {
  const { isOpen } = useSnapshot(state);

  const toggleDrawer =
    (open: boolean) =>
      (event: React.KeyboardEvent | React.MouseEvent) => {
        if (
          event.type === 'keydown' &&
          ((event as React.KeyboardEvent).key === 'Tab' ||
            (event as React.KeyboardEvent).key === 'Shift')
        ) {
          return;
        }

        state.isOpen = open;
      };

  return (
    <>
      <Box_ sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }}>
        <Canvas />
      </Box_>

      <Grid container spacing={1} sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        flexGrow: 1
      }}>
        <Grid
          container item
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box_ />
          <Box_>
            <Box_ sx={{ m: 1 }}>
              <TimeChip />
            </Box_>
          </Box_>
          <Box_ />
        </Grid>
        {/*<Grid
          container item
          justifyContent="space-between"
          alignItems="center"
        >
          <Box_ />
          <Box_ />
          <Box_ />
        </Grid>*/}
        <Grid
          container item
          justifyContent="space-between"
          alignItems="flex-end"
        >
          <Box_ />
          <Box_>
            <Box_ sx={{ m: 1 }}>
              <Fab size="small" color="primary" onClick={toggleDrawer(true)} sx={{
                pointerEvents: 'auto',
                userSelect: 'none'
              }}>
                <MenuIcon />
              </Fab>
            </Box_>
          </Box_>
          <Box_ />
        </Grid>
      </Grid>
      <Drawer
        anchor='bottom'
        open={isOpen}
        onClose={toggleDrawer(false)}
      >
        <Admin />
      </Drawer>
    </>
  )
}
