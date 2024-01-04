import * as React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListSubheader from '@mui/material/ListSubheader';
import CameraSwitch from '../cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from '../cameras-and-controls/CameraControlsSwitch';

export default function Settings() {
  return (
    <>
      <List
        sx={{
          width: '100%',
          maxWidth: 360,
          bgcolor: 'background.paper',
          position: 'relative',
          overflow: 'auto',
          maxHeight: 300,
          '& ul': { padding: 0 },
        }}
        subheader={<li />}
      >
        <li>
          <ul>
            <ListSubheader>Camera settings</ListSubheader>
            <ListItem sx={{ py: 0 }}>
              <CameraSwitch />
            </ListItem>
          </ul>
        </li>
        <li>
          <ul>
            <ListSubheader>Controls settings</ListSubheader>
            <ListItem sx={{ py: 0 }}>
              <CameraControlsSwitch />
            </ListItem>
          </ul>
        </li>
      </List>
    </>
  )
}
