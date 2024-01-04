import * as React from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import { SxProps } from '@mui/system';
import { useSnapshot } from 'valtio';
import TimeChip from '../TimeChip';
import { Paper, Stack } from '@mui/material';
import ControlStand from '../hud/ControlStand';
import SyncedChip from '../SyncedChip';
import { state as trainsState } from '@/lib/trains';
import FeatureCollections from './FeatureCollections';
import Settings from './Settings';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element

function TopInfo() {
  return (
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
  )
}

export default function GUI() {
  useSnapshot(trainsState);

  const [menuState, setMenuState] = React.useState("");

  const toggleDrawer =
    (anchor: string) =>
      (event: React.KeyboardEvent | React.MouseEvent) => {
        if (
          event.type === 'keydown' &&
          ((event as React.KeyboardEvent).key === 'Tab' ||
            (event as React.KeyboardEvent).key === 'Shift')
        ) {
          return;
        }

        setMenuState(anchor === menuState ? "" : anchor);
      };

  const menuComponents: { [key: string]: JSX.Element } = {
    'featureCollections': <FeatureCollections />,
    'settings': <Settings />,
  };

  return trainsState.activeTrainId ?
    <>
      <TopInfo />
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
    </>
    :
    <>
      {menuState ?
        <Paper square sx={{
          width: "100%",
          height: "100%",
          pointerEvents: 'auto',
          userSelect: 'none',
          p: 1,
          overflow: 'auto',
        }}>
          {menuComponents[menuState]}
        </Paper>
        :
        <TopInfo />
      }
      <Stack
        direction="row"
        alignItems="flex-end"
        spacing={1}
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        <Stack direction="row" spacing={1} sx={{
          p: 1,
        }}>
          <Fab size="small" color="primary" onClick={toggleDrawer('featureCollections')} sx={{
            pointerEvents: 'auto',
            userSelect: 'none'
          }}>
            <PlaceIcon />
          </Fab>
          <Fab size="small" color="primary" onClick={toggleDrawer('settings')} sx={{
            pointerEvents: 'auto',
            userSelect: 'none'
          }}>
            <SettingsIcon />
          </Fab>
        </Stack>
      </Stack>
    </>
}
