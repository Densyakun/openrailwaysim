import * as React from 'react';
import Box from '@mui/material/Box';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import RouteIcon from '@mui/icons-material/Route';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import TerrainIcon from '@mui/icons-material/Terrain';
import TrainIcon from '@mui/icons-material/Train';
import { SxProps } from '@mui/system';
import { proxy, useSnapshot } from 'valtio';
import TimeChip from '../TimeChip';
import { Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import SyncedChip from '../SyncedChip';
import Settings from './Settings';
import FeatureCollectionsTabPanel from './FeatureCollectionsTabPanel';
import TracksSubMenu from './TracksSubMenu';
import TrainsTabPanel from './TrainsTabPanel';
import { trainsState } from '@/lib/trains';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element;

export const guiState = proxy<{
  tabState: string;
}>({
  tabState: "",
});

function TopInfo() {
  return <Box_ sx={{
    width: "100%",
    display: "flex",
    justifyContent: 'center',
  }}>
    <Stack
      sx={{ p: 0.5 }}
      direction={'row'}
      spacing={1}
    >
      <TimeChip />
      <SyncedChip />
    </Stack>
  </Box_>;
}

export default function GUI() {
  const { tabState } = useSnapshot(guiState);
  const { activeTrainId } = useSnapshot(trainsState);

  const menuComponents: {
    [key: string]: {
      title: string;
      icon: JSX.Element;
      component?: JSX.Element;
    }
  } = {
    'terrains': {
      title: 'Terrains',
      icon: <TerrainIcon />,
    },
    'featureCollections': {
      title: 'Feature collections',
      icon: <PlaceIcon />,
      component: <FeatureCollectionsTabPanel />,
    },
    'tracks': {
      title: 'Tracks',
      icon: <RouteIcon />,
      component: <TracksSubMenu />,
    },
    'switches': {
      title: 'Switches',
      icon: <AltRouteIcon />,
    },
    'trains': {
      title: 'Trains',
      icon: <TrainIcon />,
      component: <TrainsTabPanel />,
    },
    'settings': {
      title: 'Settings',
      icon: <SettingsIcon />,
      component: <Settings />,
    },
  };

  return <Stack
    justifyContent="space-between"
    alignItems="center"
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
    <TopInfo />
    <Stack
      justifyContent="flex-end"
      alignItems="center"
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      {tabState && menuComponents[tabState].component && menuComponents[tabState].component}
    </Stack>
    {(tabState !== "trains" || !activeTrainId) &&
      <Paper elevation={0} sx={{
        m: 0.5,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}>
        <ToggleButtonGroup
          value={tabState}
          exclusive
          onChange={(
            event: React.MouseEvent<HTMLElement>,
            newValue: string | null,
          ) =>
            guiState.tabState = newValue || ""
          }
        >
          {Object.keys(menuComponents).map(id => {
            const { title, icon } = menuComponents[id];

            return <Tooltip key={id} title={title} disableInteractive>
              <ToggleButton value={id} selected={tabState === id}>
                {icon}
              </ToggleButton>
            </Tooltip>
          })}
        </ToggleButtonGroup>
      </Paper>
    }
  </Stack>;
}

export function lightingIsForEditing() {
  return guiState.tabState === "terrains"
    || guiState.tabState === "featureCollections"
    || guiState.tabState === "tracks"
    || guiState.tabState === "switches"
    || guiState.tabState === "trains";
}
