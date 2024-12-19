import { gameState } from '@/lib/client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListIcon from '@mui/icons-material/List';
import PlaceIcon from '@mui/icons-material/Place';
import TrainIcon from '@mui/icons-material/Train';
import DataMenu from './DataMenu';
import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { setCameraTargetPosition } from '../cameras-and-controls/CameraControls';
import { eulerToCoordinate, move, state as gisState } from '@/lib/gis';
import { trainsTabPanelState } from './TrainsTabPanel';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_PROP, FROM_CLIENT_SET_PROP } from '@/lib/game';
import { Train } from '@/lib/trains';

export default function TrainTable({ trainGroupId }: { trainGroupId: string }) {
  let trains: { [key: string]: Train } = {};
  gameState.trainGroups[trainGroupId].forEach(trainId =>
    trains[trainId] = gameState.trains[trainId]
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
          <Typography variant="h5" gutterBottom>{adding ? `Add a train to ${trainGroupId}` :
            //editingId ? `Edit a train "${editingId}"` :
            trainGroupId}</Typography>
        </Stack>
      )}
      objects={trains}
      listItemButtons={id => <>
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
      editable={false}
    />
  </Paper>;
}
