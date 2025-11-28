import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DepartureBoardIcon from '@mui/icons-material/DepartureBoard';
import RouteIcon from '@mui/icons-material/Route';
import TrainIcon from '@mui/icons-material/Train';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { socket } from '../Client';
import { diagramsTabPanelState, resetEditingDiagramState } from '@/lib/client/diagrams';
import { Diagram, DiagramSection } from '@/lib/diagram';
import { MessageCode, send } from '@/lib/ws';
import { store } from '@/lib/game';

export default function DiagramTable() {
  const { diagrams } = useSnapshot(store.syncData);

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
            diagramsTabPanelState.isShowTable = false
          }>
            Back
          </Button>
          <Typography variant="h5" gutterBottom>{adding ? "Add a new diagram" :
            editingId ? `Edit a diagram "${editingId}"` :
              "Diagrams"}</Typography>
        </Stack>
      )}
      objects={diagrams}
      listItemButtons={id => <>
        <Tooltip title="Edit route maps" disableInteractive>
          <IconButton edge="end" onClick={() => {
            resetEditingDiagramState();
            diagramsTabPanelState.editingSectionsInDiagramId = id;
            diagramsTabPanelState.sections = JSON.parse(JSON.stringify(store.syncData.diagrams[id].sections)) as DiagramSection[];
            if (!diagramsTabPanelState.sections.length) {
              diagramsTabPanelState.sections = [{
                routes: [{
                  trackIds: [],
                  stopOffset: 0,
                  fromPlatformName: "",
                  toPlatformName: "",
                }],
                fromDisplayName: "",
                toDisplayName: "",
                fromTimezone: "",
                toTimezone: "",
              }];
            }
          }}>
            <RouteIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit train groups" disableInteractive>
          <IconButton edge="end" onClick={() => diagramsTabPanelState.editingTrainGroupsInDiagramId = id} disabled>
            <TrainIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit diagram curves" disableInteractive>
          <IconButton edge="end" onClick={() => {
            diagramsTabPanelState.editingDiagramCurvesInDiagramId = id;
            diagramsTabPanelState.diagramCurves = JSON.parse(JSON.stringify(store.syncData.diagrams[id].diagramCurves));
          }}>
            <DepartureBoardIcon />
          </IconButton>
        </Tooltip>
      </>}
      handleSubmit={((inputs, editingId) => {
        send(socket, MessageCode.FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["diagrams", inputs.id],
          store.syncData.diagrams[editingId],
          ["diagrams", editingId],
        ] : [
          ["diagrams", inputs.id],
          store.syncData.diagrams[inputs.id] || {
            sections: [],
            trainGroups: [],
            diagramCurves: [],
            country: "",
            state: "",
            region: "",
          } as Diagram,
        ]);
      })}
      handleDelete={(id =>
        send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["diagrams", id])
      )}
    />
  </Paper>;
}
