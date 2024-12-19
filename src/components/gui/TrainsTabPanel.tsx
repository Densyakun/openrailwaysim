import * as React from 'react';
import { proxy, useSnapshot } from 'valtio';
import { Drawer, Fab, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import TuneIcon from '@mui/icons-material/Tune';
import UIOneHandleMasterControllerConfigTable from './UIOneHandleMasterControllerConfigTable';
import { trainsState } from '@/lib/trains';
import ControlStand from '../hud/ControlStand';
import TrainGroupTable from './TrainGroupTable';
import TrainTable from './TrainTable';

export const trainsTabPanelState = proxy<{
  isShowTable: boolean;
  menuState: string;
  selectedTrainGroup: string;
}>({
  isShowTable: false,
  menuState: "",
  selectedTrainGroup: "",
});

function TrainsMenu() {
  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title="Toggle table" disableInteractive>
        <Fab size="small" color="primary" onClick={() => trainsTabPanelState.isShowTable = true} sx={{
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <TableViewIcon />
        </Fab>
      </Tooltip>
      <Paper elevation={0}>
        <ToggleButtonGroup
          value={trainsTabPanelState.menuState}
          exclusive
          onChange={(
            event: React.MouseEvent<HTMLElement>,
            newValue: string | null,
          ) => {
            trainsTabPanelState.menuState = newValue || "";
          }}
        >
          <ToggleButton value="placeAxle" selected={trainsTabPanelState.menuState === "placeAxle"}>
            Place axle
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>
      <Paper elevation={0}>
        <IconButton color="primary" onClick={toggleDrawer(true)}>
          <TuneIcon />
        </IconButton>
        <Drawer open={open} onClose={toggleDrawer(false)}>
          <Stack sx={{ width: 480 }}>
            <UIOneHandleMasterControllerConfigTable />
          </Stack>
        </Drawer>
      </Paper>
    </Stack>
  </Paper>;
}

export default function TrainsTabPanel() {
  const { isShowTable, selectedTrainGroup } = useSnapshot(trainsTabPanelState);
  const { activeTrainId } = useSnapshot(trainsState);

  return isShowTable
    ? selectedTrainGroup
      ? <TrainTable trainGroupId={selectedTrainGroup} />
      : <TrainGroupTable />
    : activeTrainId
      ? <ControlStand />
      : <TrainsMenu />;
}