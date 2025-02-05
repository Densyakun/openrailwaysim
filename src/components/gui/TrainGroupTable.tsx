import { gameState } from '@/lib/client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListIcon from '@mui/icons-material/List';
import TrainIcon from '@mui/icons-material/Train';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_PROP, FROM_CLIENT_SET_PROP } from '@/lib/game';
import { trainsTabPanelState } from '@/lib/client/trains';

export default function TrainGroupTable() {
  useSnapshot(gameState.data);

  return <Paper square sx={{
    width: "100%",
    height: "100%",
    pointerEvents: 'auto',
    userSelect: 'none',
    p: 1,
    overflow: 'auto',
    backgroundColor: '#000b',
  }}>
    <DataMenu
      defaultValues={{ id: '', trainIds: [] }}
      getValueOnEdit={(newId: string) => ({ id: newId, trainIds: gameState.data.trainGroups[newId] })}
      titleElement={(adding: boolean, editingId: string) => (
        <Stack spacing={1} direction={'row'} alignItems={'center'}>
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
            trainsTabPanelState.isShowTable = false
          }>
            Back
          </Button>
          <TrainIcon />
          <Typography variant="h5" gutterBottom>{adding ? "Add a new train group" :
            editingId ? `Edit a train group "${editingId}"` :
              "Train groups"}</Typography>
        </Stack>
      )}
      objects={gameState.data.trainGroups}
      listItemButtons={id => <>
        <Tooltip title="Open train list" disableInteractive>
          <IconButton edge="end" onClick={() => trainsTabPanelState.selectedTrainGroup = id}>
            <ListIcon />
          </IconButton>
        </Tooltip>
      </>}
      handleSubmit={((inputs, editingId) =>
        socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["trainGroups", inputs.id],
          inputs.trainIds,
          ["trainGroups", editingId],
        ] : [
          ["trainGroups", inputs.id],
          inputs.trainIds,
        ]]))
      )}
      handleDelete={(id =>
        socket.send(JSON.stringify([FROM_CLIENT_DELETE_PROP, ["trainGroups", id]]))
      )}
    />
  </Paper>;
}
