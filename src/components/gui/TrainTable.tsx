import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceIcon from '@mui/icons-material/Place';
import TrainIcon from '@mui/icons-material/Train';
import DataMenu from './DataMenu';
import { 
  Button, 
  IconButton, 
  Paper, 
  Stack, 
  Tooltip, 
  Typography 
} from '@mui/material';
import { socket } from '../Client';
import { Train } from '@/lib/trains';
import { resetEditingTrainState, trainsTabPanelState, trainsState } from '@/lib/client/trains';
import { useSnapshot } from 'valtio';
import { setCameraTargetPosition } from '@/lib/client/camera';
import { MessageCode, send } from '@/lib/ws';
import { store } from '@/lib/game';

export default function TrainTable({ trainGroupId }: { trainGroupId: string }) {
  const { trainGroups, trains } = useSnapshot(store.data);
  const { selectedTrainId } = useSnapshot(trainsState);

  let trains_: { [key: string]: Train } = {};
  const groupTrainIds = trainGroups[trainGroupId] ?? [];
  groupTrainIds.forEach(trainId => {
    if (trains[trainId]) {
      trains_[trainId] = trains[trainId] as Train;
    }
  });

  return (
    <Paper square sx={{
      width: "100%",
      height: "100%",
      pointerEvents: 'auto',
      userSelect: 'none',
      p: 2,
      overflow: 'auto',
      backgroundColor: '#000d',
    }}>
      <DataMenu
        defaultValues={{ id: '' }}
        getValueOnEdit={(newId: string) => ({ id: newId })}
        titleElement={(adding: boolean, editingId: string) => (
          <Stack spacing={1} direction={'row'} alignItems={'center'}>
            <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
              trainsTabPanelState.selectedTrainGroup = ""
            }>
              Back
            </Button>
            <TrainIcon />
            <Typography variant="h6">{trainGroupId}</Typography>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => {
              resetEditingTrainState();
              trainsTabPanelState.isAddingTrain = true;
              trainsTabPanelState.selectedTrainGroup = trainGroupId;
              
              let index = 1;
              while (store.data.trains[`train_${index}`]) {
                index++;
              }
              trainsTabPanelState.newTrainId = `train_${index}`;
              
              const formatKeys = Object.keys(store.data.trainFormats).filter(k => !k.startsWith('__'));
              if (formatKeys.length > 0) {
                trainsTabPanelState.trainFormatId = formatKeys[0];
              }
            }}>
              Add
            </Button>
          </Stack>
        )}
        objects={trains_}
        selectedId={selectedTrainId}
        onItemClick={(id) => {
          trainsState.selectedTrainId = id;
          trainsState.selectedBodyIndex = -1; // デフォルトは全体
        }}
        getSecondaryText={(id, train: any) => train?.trainFormatId ? `形式: ${train.trainFormatId}` : ""}
        listItemButtons={id => <>
          <Tooltip title="カメラをここに移動" disableInteractive>
            <IconButton edge="end" size="small" onClick={(e) => {
              e.stopPropagation();
              const train = store.data.trains[id];
              if (train && train.bogies[0]) {
                setCameraTargetPosition(train.bogies[0].position, true);
                trainsState.selectedTrainId = id;
                trainsState.selectedBodyIndex = -1;
              }
            }}>
              <PlaceIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>}
        handleDelete={(id => {
          if (selectedTrainId === id) {
            trainsState.selectedTrainId = "";
            trainsState.selectedBodyIndex = -1;
            trainsState.isCameraFollowing = false;
          }
          send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["trains", id]);
        })}
        showDefaultAddButton={false}
        showDefaultEditButton={false}
      />
    </Paper>
  );
}
