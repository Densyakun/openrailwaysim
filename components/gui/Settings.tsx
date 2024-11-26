import * as React from 'react';
import SaveIcon from '@mui/icons-material/Save';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListSubheader from '@mui/material/ListSubheader';
import CameraSwitch from '../cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from '../cameras-and-controls/CameraControlsSwitch';
import { Button, Stack } from '@mui/material';
import { socket } from '../Client';
import { FROM_CLIENT_SAVE } from '@/lib/game';
import CameraFarTextField from '../cameras-and-controls/CameraFarTextField';

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
              <Stack spacing={1}>
                <CameraSwitch />
                <CameraFarTextField />
              </Stack>
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
      <Button variant="contained" startIcon={<SaveIcon />} onClick={() => socket.send(JSON.stringify([FROM_CLIENT_SAVE]))}>
        Save world
      </Button>
    </>
  )
}
