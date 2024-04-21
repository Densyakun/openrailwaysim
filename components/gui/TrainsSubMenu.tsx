import * as React from 'react';
import { proxy, useSnapshot } from 'valtio';
import { Drawer, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import UIOneHandleMasterControllerConfigTable from './UIOneHandleMasterControllerConfigTable';

export const trainsSubMenuState = proxy<{
  menuState: string;
}>({
  menuState: "",
});

export default function TrainsSubMenu() {
  useSnapshot(trainsSubMenuState);

  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
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
    </>
  );
}