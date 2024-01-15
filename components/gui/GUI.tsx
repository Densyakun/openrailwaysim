import * as React from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import RouteIcon from '@mui/icons-material/Route';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import TrainIcon from '@mui/icons-material/Train';
import { SxProps } from '@mui/system';
import { useSnapshot } from 'valtio';
import TimeChip from '../TimeChip';
import { Paper, Stack, Tooltip } from '@mui/material';
import ControlStand from '../hud/ControlStand';
import SyncedChip from '../SyncedChip';
import { state as trainsState } from '@/lib/trains';
import FeatureCollections from './FeatureCollections';
import ProjectedLines from './ProjectedLines';
import Settings from './Settings';
import Trains from './Trains';
import Feature from './Feature';

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
    'projectedLines': <ProjectedLines />,
    'trains': <Trains />,
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
          backgroundColor: '#000b',
        }}>
          {menuComponents[menuState]}
        </Paper>
        :
        <>
          <TopInfo />
          <Box_ sx={{
            pointerEvents: 'auto',
            userSelect: 'none',
          }}>
            <Feature />
          </Box_>
        </>
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
          <Tooltip title="Feature collections" disableInteractive>
            <Fab size="small" color="primary" onClick={toggleDrawer('featureCollections')} sx={{
              pointerEvents: 'auto',
              userSelect: 'none'
            }}>
              <PlaceIcon />
            </Fab>
          </Tooltip>
          <Tooltip title="Projected lines" disableInteractive>
            <Fab size="small" color="primary" onClick={toggleDrawer('projectedLines')} sx={{
              pointerEvents: 'auto',
              userSelect: 'none'
            }}>
              <RouteIcon />
            </Fab>
          </Tooltip>
          <Tooltip title="Trains" disableInteractive>
            <Fab size="small" color="primary" onClick={toggleDrawer('trains')} sx={{
              pointerEvents: 'auto',
              userSelect: 'none'
            }}>
              <TrainIcon />
            </Fab>
          </Tooltip>
          <Tooltip title="Settings">
            <Fab size="small" color="primary" onClick={toggleDrawer('settings')} sx={{
              pointerEvents: 'auto',
              userSelect: 'none'
            }}>
              <SettingsIcon />
            </Fab>
          </Tooltip>
        </Stack>
      </Stack>
    </>
}
