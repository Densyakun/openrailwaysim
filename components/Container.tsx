import * as React from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import MenuIcon from '@mui/icons-material/Menu';
import { SxProps } from '@mui/system';
import { proxy, useSnapshot } from 'valtio';
import Canvas from './Canvas';
import TimeChip from './TimeChip';
import { Stack } from '@mui/material';
import ControlStand from './hud/ControlStand';
import SyncedChip from './SyncedChip';

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
        <Stack
          direction="row"
          alignItems="flex-start"
          spacing={1}
          sx={{
            width: "100%",
            height: "100%",
          }}
        >
          <Box_ sx={{
            width: "100%",
            display: "flex",
            justifyContent: 'flex-start',
          }}>
          </Box_>
          <Box_ sx={{
            width: "100%",
            display: "flex",
            justifyContent: 'center',
          }}>
            <Stack
              sx={{ p: 1 }}
              direction={'row'}
              spacing={1}
            >
              <TimeChip />
              <SyncedChip />
            </Stack>
          </Box_>
          <Box_ sx={{
            width: "100%",
            display: "flex",
            justifyContent: 'flex-end',
          }}>
          </Box_>
        </Stack>
        {/*<Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            width: "100%",
            height: "100%",
          }}
        >
        </Stack>*/}
        <Stack
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
              <ControlStand />
            </Box_>
          </Box_>
          <Box_ sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: 'center',
            alignItems: 'flex-end',
          }}>
            <Box_ sx={{
              p: 1,
            }}>
              <Fab size="small" color="primary" onClick={toggleDrawer(true)} sx={{
                pointerEvents: 'auto',
                userSelect: 'none'
              }}>
                <MenuIcon />
              </Fab>
            </Box_>
          </Box_>
          <Box_ sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: 'flex-end',
            alignItems: 'flex-end',
          }}>
          </Box_>
        </Stack>
      </Stack>
    </>
  )
}
