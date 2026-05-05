import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import TrainIcon from '@mui/icons-material/Train';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import EditIcon from '@mui/icons-material/Edit';
import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { socket } from '../Client';
import { resetEditingTrainState, trainsTabPanelState } from '@/lib/client/trains';
import { formState } from './TrainFormatEditPanel';
import { MessageCode, send } from '@/lib/ws';
import { serialize, store, trainFormatTypeId } from "@/lib/game";

export default function TrainFormatTable() {
  const { trainFormats } = useSnapshot(store.data);

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
            trainsTabPanelState.isShowTrainFormatTable = false
          }>
            Back
          </Button>
          <TrainIcon />
          <Typography variant="h5" gutterBottom>{adding ? "Add a new train format" :
            editingId ? `Edit a train format "${editingId}"` :
              "Train formats"}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
            resetEditingTrainState();
            trainsTabPanelState.isAddingTrainFormat = true;
            formState.editingTrainFormatMode = "standard";
            trainsTabPanelState.editingTrainFormat = {
              bogies: [],
              otherBodyOffsets: [],
              otherBodyWeights: [],
              cabFormats: [],
              bodySupporterJoints: [],
              otherJoints: [],
            };
          }}>
            Add
          </Button>
        </Stack>
      )}
      objects={trainFormats}
      // TODO 編集機能をオーバーライド
      listItemButtons={id => <>
        <Tooltip title="Edit" disableInteractive>
          <IconButton edge="end" onClick={() => {
            resetEditingTrainState();
            formState.editingTrainFormatMode = "advanced";
            trainsTabPanelState.editingTrainFormatId = id;
            trainsTabPanelState.editingTrainFormat = JSON.parse(JSON.stringify(store.data.trainFormats[id]));
          }}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      </>}
      handleSubmit={((inputs, editingId) => {
        const trainFormat = editingId && editingId !== inputs.id
          ? store.data.trainFormats[editingId]
          : store.data.trainFormats[inputs.id] || {
            bogies: [],
            otherBodyOffsets: [],
            otherBodyWeights: [],
            cabFormats: [],
            bodySupporterJoints: [],
            otherJoints: [],
          };

        const serializedTrainFormat = serialize(trainFormatTypeId, trainFormat);

        send(socket, MessageCode.FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["trainFormats", inputs.id],
          serializedTrainFormat,
          ["trainFormats", editingId],
        ] : [
          ["trainFormats", inputs.id],
          serializedTrainFormat,
        ]);
      })}
      handleDelete={(id =>
        send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["trainFormats", id])
      )}
      showDefaultAddButton={false}
      showDefaultEditButton={false}
    />
  </Paper>;
}
