import { gameState } from '@/lib/client';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceIcon from '@mui/icons-material/Place';
import TrainIcon from '@mui/icons-material/Train';
import DataMenu from './DataMenu';
import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';
import { eulerToCoordinate, move, state as gisState } from '@/lib/gis';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_PROP } from '@/lib/game';
import { Train } from '@/lib/trains';
import { resetEditingTrainState, trainsTabPanelState } from '@/lib/client/trains';
import { useSnapshot } from 'valtio';

export default function TrainTable({ trainGroupId }: { trainGroupId: string }) {
  const { trainGroups, trains } = useSnapshot(gameState);

  let trains_: { [key: string]: Train } = {};
  trainGroups[trainGroupId].forEach(trainId =>
    trains_[trainId] = trains[trainId] as Train
  );

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
      defaultValues={{ id: ''/*, trainIds: []*/ }}
      getValueOnEdit={(newId: string) => ({ id: newId/*, trainIds: gameState.trainGroups[newId]*/ })}
      titleElement={(adding: boolean, editingId: string) => (
        <Stack spacing={1} direction={'row'} alignItems={'center'}>
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
            trainsTabPanelState.selectedTrainGroup = ""
          }>
            Back
          </Button>
          <TrainIcon />
          <Typography variant="h5" gutterBottom>{trainGroupId}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
            trainsTabPanelState.isAddingTrain = true;
            resetEditingTrainState();
            trainsTabPanelState.bogieOffsets = [0];
            trainsTabPanelState.bogieWeights = [0];
            trainsTabPanelState.axleTable = [[{
              z: 0,
              diameter: 0.86,
              hasMotor: true,
            }]];
          }}>
            Add
          </Button>
        </Stack>
      )}
      objects={trains_}
      listItemButtons={id => <>
        {/** TODO Edit button */}
        <Tooltip title="Move camera to object" disableInteractive>
          <IconButton edge="end" onClick={() => {
            const train = gameState.trains[id]

            const targetCoordinate = eulerToCoordinate(train.globalPosition)
            const position = train.bogies[0].axles[0].position
            setCameraTargetPosition(targetCoordinate, position.y)
            move(gisState.originTransform.quaternion, position.x, position.z)
          }}>
            <PlaceIcon />
          </IconButton>
        </Tooltip>
      </>}
      /*handleSubmit={((inputs, editingId) =>
        socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["trainGroups", inputs.id],
          inputs.trainIds,
          ["trainGroups", editingId],
        ] : [
          ["trainGroups", inputs.id],
          inputs.trainIds,
        ]]))
      )}*/
      handleDelete={(id => {
        socket.send(JSON.stringify([FROM_CLIENT_DELETE_PROP, ["trains", id]]));
      })}
      addable={false}
      editable={false}
    />
  </Paper>;
}
