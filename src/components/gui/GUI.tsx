import Box from '@mui/material/Box';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import DepartureBoardIcon from '@mui/icons-material/DepartureBoard';
import PeopleIcon from '@mui/icons-material/People';
import RouteIcon from '@mui/icons-material/Route';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import TerrainIcon from '@mui/icons-material/Terrain';
import TrainIcon from '@mui/icons-material/Train';
import BuildIcon from '@mui/icons-material/Build';
import PlatformIcon from '@mui/icons-material/Train';
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
import ConstructionTabPanel from './ConstructionTabPanel';
import PlatformsTabPanel from './PlatformsTabPanel';
import DataExchangePanel from './DataExchangePanel';
import { guiState } from '@/lib/client/gui';
import { useEffect } from 'react';
import { trainsState } from '@/lib/client/trains';
import DiagramsTabPanel from './DiagramsTabPanel';
import CameraPositionChip from '../CameraPositionChip';
import TerrainsTabPanel from './TerrainsTabPanel';
import SwitchPlacementPanel from './SwitchPlacementPanel';
import { store } from '@/lib/game';

const horizontalScrollSx = {
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
} as const;

function TopInfo() {
  return <Box sx={{
    width: "100%",
    maxWidth: "100%",
    flexShrink: 0,
    pointerEvents: 'auto',
    ...horizontalScrollSx,
    pt: 'env(safe-area-inset-top)',
  }}>
    <Stack
      sx={{ p: 0.5, width: 'fit-content', mx: 'auto', flexWrap: 'nowrap' }}
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
    component: <SwitchPlacementPanel />,
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
  'construction': {
    title: 'Construction',
    icon: <BuildIcon />,
    component: <ConstructionTabPanel />,
  },
  'platforms': {
    title: 'Platforms',
    icon: <PlatformIcon />,
    component: <PlatformsTabPanel />,
  },
  'dataExchange': {
    title: 'Data',
    icon: <ImportExportIcon />,
    component: <DataExchangePanel />,
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
      trainsState.isCabView = false;
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
        flexShrink: 1,
        minHeight: 0,
        maxHeight: 'calc(100dvh - 96px)',
        p: 1,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{
        maxWidth: 'min(480px, 90vw)',
        width: 'fit-content',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        '& > *': {
          maxWidth: 'min(480px, 90vw)',
          boxSizing: 'border-box',
        }
      }}>
        {selectedTab && menuComponents[selectedTab].component && menuComponents[selectedTab].component}
      </Box>
    </Stack>
    {(selectedTab !== "trains" || !activeTrainId) &&
      <Paper elevation={0} sx={{
        m: 0.5,
        mb: 'calc(4px + env(safe-area-inset-bottom))',
        maxWidth: 'calc(100% - 8px)',
        flexShrink: 0,
        pointerEvents: 'auto',
        userSelect: 'none',
        ...horizontalScrollSx,
      }}>
        <ToggleButtonGroup
          sx={{ width: 'fit-content', mx: 'auto' }}
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
