import * as React from 'react';
import { proxy, useSnapshot } from 'valtio';
import { Drawer, Fab, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import TuneIcon from '@mui/icons-material/Tune';
import UIOneHandleMasterControllerConfigTable from './UIOneHandleMasterControllerConfigTable';
import { guiState } from './GUI';

export const trainsSubMenuState = proxy<{
  menuState: string;
  selectedTrainGroup: string;
}>({
  menuState: "",
  selectedTrainGroup: "",
});

export default function TrainsSubMenu() {
  useSnapshot(trainsSubMenuState);

  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return (
    <Paper sx={{ p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title="Toggle table" disableInteractive>
          <Fab size="small" color="primary" onClick={() => guiState.isShowTable = !guiState.isShowTable} sx={{
            pointerEvents: 'auto',
            userSelect: 'none'
          }}>
            <TableViewIcon />
          </Fab>
        </Tooltip>
        <Paper elevation={0}>
          <ToggleButtonGroup
            value={trainsSubMenuState.menuState}
            exclusive
            onChange={(
              event: React.MouseEvent<HTMLElement>,
              newValue: string | null,
            ) => {
              trainsSubMenuState.menuState = newValue || "";
            }}
          >
            <ToggleButton value="placeAxle" selected={trainsSubMenuState.menuState === "placeAxle"}>
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
    </Paper>
  );
}