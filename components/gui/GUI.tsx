import * as React from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import RouteIcon from '@mui/icons-material/Route';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import TableViewIcon from '@mui/icons-material/TableView';
import TrainIcon from '@mui/icons-material/Train';
import { SxProps } from '@mui/system';
import { proxy, useSnapshot } from 'valtio';
import TimeChip from '../TimeChip';
import { Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import ControlStand from '../hud/ControlStand';
import SyncedChip from '../SyncedChip';
import { state as trainsState } from '@/lib/trains';
import FeatureCollectionTable from './FeatureCollectionTable';
//import ProjectedLineTable from './ProjectedLineTable';
import Settings from './Settings';
import TrainTable from './TrainTable';
import FeatureCollectionsSubMenu from './FeatureCollectionsSubMenu';
//import TrackTable from './TrackTable';
import TracksSubMenu from './TracksSubMenu';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element

export const guiState = proxy<{
  menuState: string;
  isShowTable: boolean;
}>({
  menuState: "",
  isShowTable: false,
});

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

function SubMenu() {
  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Tooltip title="Toggle table" disableInteractive>
      <Fab size="small" color="primary" onClick={() => guiState.isShowTable = !guiState.isShowTable} sx={{
        pointerEvents: 'auto',
        userSelect: 'none'
      }}>
        <TableViewIcon />
      </Fab>
    </Tooltip>
  </Paper>
}

export default function GUI() {
  useSnapshot(guiState);
  useSnapshot(trainsState);

  const menuComponents: {
    [key: string]: {
      title: string;
      icon: JSX.Element;
      component?: JSX.Element;
      subMenu?: JSX.Element;
      table?: JSX.Element;
    }
  } = {
    'featureCollections': {
      title: 'Feature collections',
      icon: <PlaceIcon />,
      subMenu: <FeatureCollectionsSubMenu />,
      table: <FeatureCollectionTable />,
    },
    /*'projectedLines': {
          title: 'Projected lines',
        icon: <RouteIcon />,
        subMenu: <SubMenu />,
        table: <ProjectedLineTable />,
    },*/
    'tracks': {
      title: 'Tracks',
      icon: <RouteIcon />,
      subMenu: <TracksSubMenu />,
      //table: <TrackTable />,
    },
    'trains': {
      title: 'Trains',
      icon: <TrainIcon />,
      subMenu: <SubMenu />,
      table: <TrainTable />,
    },
    'settings': {
      title: 'Settings',
      icon: <SettingsIcon />,
      component: <Settings />,
    },
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
      {guiState.menuState &&
        (menuComponents[guiState.menuState].component ||
          guiState.isShowTable && menuComponents[guiState.menuState].table) ?
        <Paper square sx={{
          width: "100%",
          height: "100%",
          pointerEvents: 'auto',
          userSelect: 'none',
          p: 1,
          overflow: 'auto',
          backgroundColor: '#000b',
        }}>
          {guiState.isShowTable ? menuComponents[guiState.menuState].table : menuComponents[guiState.menuState].component}
        </Paper>
        :
        <>
          <TopInfo />
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
        <Stack direction="column" spacing={1} alignItems={'center'} sx={{
          p: 1,
          pointerEvents: 'auto',
          userSelect: 'none',
        }}>
          {guiState.menuState && menuComponents[guiState.menuState].subMenu}
          <Paper elevation={0}>
            <ToggleButtonGroup
              value={guiState.menuState}
              exclusive
              onChange={(
                event: React.MouseEvent<HTMLElement>,
                newValue: string | null,
              ) => {
                guiState.menuState = newValue || "";
              }}
            >
              {Object.keys(menuComponents).map(id => {
                const { title, icon } = menuComponents[id]

                return <Tooltip key={id} title={title} disableInteractive>
                  <ToggleButton value={id} selected={guiState.menuState === id}>
                    {icon}
                  </ToggleButton>
                </Tooltip>
              })}
            </ToggleButtonGroup>
          </Paper>
        </Stack>
      </Stack>
    </>
}
