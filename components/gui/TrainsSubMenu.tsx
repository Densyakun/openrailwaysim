import * as React from 'react';
import { proxy, useSnapshot } from 'valtio';
import { Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';

export const trainsSubMenuState = proxy<{
  menuState: string;
}>({
  menuState: "",
});

export default function TrainsSubMenu() {
  useSnapshot(trainsSubMenuState);

  return (
    <>
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
    </>
  );
}