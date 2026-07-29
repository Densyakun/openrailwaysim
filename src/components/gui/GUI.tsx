import Box from '@mui/material/Box';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import DepartureBoardIcon from '@mui/icons-material/DepartureBoard';
import PeopleIcon from '@mui/icons-material/People';
import RouteIcon from '@mui/icons-material/Route';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import TerrainIcon from '@mui/icons-material/Terrain';
import TrainIcon from '@mui/icons-material/Train';
import { useSnapshot } from 'valtio';
import TimeChip from '../TimeChip';
import { Alert, Paper, Snackbar, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import ConnectionChip from '../ConnectionChip';
import { clientState } from '@/lib/client/client';
import Settings from './Settings';
import UserListPanel from '../UserListPanel';
import FeatureCollectionsTabPanel from './FeatureCollectionsTabPanel';
import TracksSubMenu from './TracksSubMenu';
import TrainsTabPanel from './TrainsTabPanel';
import { guiState } from '@/lib/client/gui';
import { useEffect } from 'react';
import { trainsState } from '@/lib/client/trains';
import DiagramsTabPanel from './DiagramsTabPanel';
import CameraPositionChip from '../CameraPositionChip';
import TerrainsTabPanel from './TerrainsTabPanel';
import { store } from '@/lib/game';

function TopInfo() {
  return <Box sx={{
    width: "100%",
    display: "flex",
    justifyContent: 'center',
  }}>
    <Stack
      sx={{ p: 0.5 }}
      direction={'row'}
      spacing={1}
    >
      <ConnectionChip />
      <TimeChip />
      <CameraPositionChip />
    </Stack>
  </Box>;
}

const menuComponents: {
  [key: string]: {
    title: string;
    icon: JSX.Element;
    component?: JSX.Element;
  }
} = {
  'users': {
    title: 'Users',
    icon: <PeopleIcon />,
    component: <UserListPanel />,
  },
  'terrains': {
    title: 'Terrains',
    icon: <TerrainIcon />,
    component: <TerrainsTabPanel />,
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
  'diagrams': {
    title: 'Diagrams',
    icon: <DepartureBoardIcon />,
    component: <DiagramsTabPanel />,
  },
  'settings': {
    title: 'Settings',
    icon: <SettingsIcon />,
    component: <Settings />,
  },
};

export default function GUI() {
  const { selectedTab, alignItems } = useSnapshot(guiState);
  const { activeTrainId } = useSnapshot(trainsState);
  const { trains } = useSnapshot(store.data);
  const { showSaveSuccess } = useSnapshot(clientState);

  useEffect(() => {
    guiState.alignItems = "center";
  }, [selectedTab]);

  useEffect(() => {
    if (activeTrainId && !trains[activeTrainId]) {
      trainsState.activeTrainId = "";
      trainsState.activeBodyIndex = -1;
    }
  }, [activeTrainId, trains]);

  useEffect(() => {
    const { selectedTrainId } = trainsState;
    if (selectedTrainId && !trains[selectedTrainId]) {
      trainsState.selectedTrainId = "";
      trainsState.selectedBodyIndex = -1;
      trainsState.isCameraFollowing = false;
    }
  }, [trains]);

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
      alignItems={alignItems}
      sx={{
        width: '100%',
        flexGrow: 1,
        minHeight: 0,
      }}
    >
      {selectedTab && menuComponents[selectedTab].component && menuComponents[selectedTab].component}
    </Stack>
    {(selectedTab !== "trains" || !activeTrainId) &&
      <Paper elevation={0} sx={{
        m: 0.5,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}>
        <ToggleButtonGroup
          value={selectedTab}
          exclusive
          onChange={(
            event: React.MouseEvent<HTMLElement>,
            newValue: string | null,
          ) =>
            guiState.selectedTab = newValue || ""
          }
        >
          {Object.keys(menuComponents).map(id => {
            const { title, icon } = menuComponents[id];

            return <Tooltip key={id} title={title} disableInteractive>
              <ToggleButton value={id} selected={selectedTab === id}>
                {icon}
              </ToggleButton>
            </Tooltip>
          })}
        </ToggleButtonGroup>
      </Paper>
    }
    <Snackbar
      open={showSaveSuccess}
      autoHideDuration={3000}
      onClose={() => { clientState.showSaveSuccess = false; }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ pointerEvents: 'auto' }}
    >
      <Alert
        onClose={() => { clientState.showSaveSuccess = false; }}
        severity="success"
        variant="filled"
        sx={{ width: '100%' }}
      >
        セーブデータを保存しました。
      </Alert>
    </Snackbar>
  </Stack>;
}
