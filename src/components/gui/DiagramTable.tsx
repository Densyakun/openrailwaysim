import { gameState } from '@/lib/client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DepartureBoardIcon from '@mui/icons-material/DepartureBoard';
import RouteIcon from '@mui/icons-material/Route';
import TrainIcon from '@mui/icons-material/Train';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { socket } from '../Client';
import { FROM_CLIENT_DELETE_PROP, FROM_CLIENT_SET_PROP } from '@/lib/game';
import { diagramsTabPanelState, resetEditingDiagramState } from '@/lib/client/diagrams';
import { Diagram, DiagramTrackRoute } from '@/lib/diagram';

export default function DiagramTable() {
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
      objects={gameState.data.diagrams}
      listItemButtons={id => <>
        <Tooltip title="Edit route maps" disableInteractive>
          <IconButton edge="end" onClick={() => {
            resetEditingDiagramState();
            diagramsTabPanelState.editingRouteMapsInDiagramId = id;
            diagramsTabPanelState.routeMap = JSON.parse(JSON.stringify(gameState.data.diagrams[id].routeMap)) as DiagramTrackRoute[][];
            if (!diagramsTabPanelState.routeMap.length) {
              diagramsTabPanelState.routeMap = [[{
                fromDisplayName: "",
                toDisplayName: "",
                fromTimezone: "",
                toTimezone: "",
                trackIds: [],
                stopOffset: 0,
              }]];
            }
          }}>
            <RouteIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit train groups" disableInteractive>
          <IconButton edge="end" onClick={() => diagramsTabPanelState.editingTrainGroupsInDiagramId = id}>
            <TrainIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit diagram curves" disableInteractive>
          <IconButton edge="end" onClick={() => {
            diagramsTabPanelState.editingDiagramCurvesInDiagramId = id;
            diagramsTabPanelState.diagramCurves = JSON.parse(JSON.stringify(gameState.data.diagrams[id].diagramCurves));
          }}>
            <DepartureBoardIcon />
          </IconButton>
        </Tooltip>
      </>}
      handleSubmit={((inputs, editingId) => {
        socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["diagrams", inputs.id],
          gameState.data.diagrams[editingId],
          ["diagrams", editingId],
        ] : [
          ["diagrams", inputs.id],
          gameState.data.diagrams[inputs.id] || {
            routeMap: [],
            trainGroups: [],
            diagramCurves: [],
            country: "",
            state: "",
            region: "",
          } as Diagram,
        ]]));
      })}
      handleDelete={(id =>
        socket.send(JSON.stringify([FROM_CLIENT_DELETE_PROP, ["diagrams", id]]))
      )}
    />
  </Paper>;
}
