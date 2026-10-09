import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListIcon from '@mui/icons-material/List';
import TrainIcon from '@mui/icons-material/Train';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { socket } from '../Client';
import { trainsTabPanelState } from '@/lib/client/trains';
import { MessageCode, send } from '@/lib/ws';
import { store } from '@/lib/game';

export default function TrainGroupTable() {
  const { trainGroups } = useSnapshot(store.data);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      defaultValues={{ id: '' }}
      getValueOnEdit={(newId: string) => ({ id: newId })}
      titleElement={(adding: boolean, editingId: string) => (
        <Stack spacing={1} direction={'row'} alignItems={'center'}>
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
            trainsTabPanelState.isShowTrainTable = false
          }>
            Back
          </Button>
          <TrainIcon />
          <Typography variant="h5" gutterBottom>{adding ? "Add a new train group" :
            editingId ? `Edit a train group "${editingId}"` :
              "Train groups"}</Typography>
        </Stack>
      )}
      objects={trainGroups}
      // 列車グループに属する列車数を表示する (#63)
      getSecondaryText={(_id, obj) => `${Array.isArray(obj) ? obj.length : 0} 列車`}
      listItemButtons={id => <>
        <Tooltip title="Open train list" disableInteractive>
          <IconButton edge="end" onClick={() => trainsTabPanelState.selectedTrainGroup = id}>
            <ListIcon />
          </IconButton>
        </Tooltip>
      </>}
      handleSubmit={((inputs, editingId) =>
        send(socket, MessageCode.FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["trainGroups", inputs.id],
          store.data.trainGroups[editingId],
          ["trainGroups", editingId],
        ] : [
          ["trainGroups", inputs.id],
          store.data.trainGroups[inputs.id] || [],
        ])
      )}
      // 削除時は確認ダイアログを表示する (#62)
      handleDelete={(id => setDeleteConfirmId(id))}
    />
    <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)}>
      <DialogTitle>列車グループを削除</DialogTitle>
      <DialogContent>
        <DialogContentText>
          "{deleteConfirmId}" を削除します。このグループに属する列車（{deleteConfirmId ? (trainGroups[deleteConfirmId]?.length ?? 0) : 0} 列車）も削除されます。元に戻せません。
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => {
          if (deleteConfirmId)
            send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["trainGroups", deleteConfirmId]);
          setDeleteConfirmId(null);
        }}>Delete</Button>
      </DialogActions>
    </Dialog>
  </Paper>;
}
