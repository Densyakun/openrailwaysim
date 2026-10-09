import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DepartureBoardIcon from '@mui/icons-material/DepartureBoard';
import RouteIcon from '@mui/icons-material/Route';
import TrainIcon from '@mui/icons-material/Train';
import { useSnapshot } from 'valtio';
import DataMenu from './DataMenu';
import { Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';
import { socket } from '../Client';
import { diagramsTabPanelState, resetEditingDiagramState } from '@/lib/client/diagrams';
import { Diagram, DiagramSection } from '@/lib/diagram';
import { MessageCode, send } from '@/lib/ws';
import { store } from '@/lib/game';

type DiagramForm = {
  id: string;
  country: string;
  state: string;
  region: string;
};

export default function DiagramTable() {
  const { diagrams } = useSnapshot(store.data);

  return <Paper square sx={{
    width: "100%",
    height: "100%",
    pointerEvents: 'auto',
    userSelect: 'none',
    p: 1,
    overflow: 'auto',
    backgroundColor: '#000b',
  }}>
    <DataMenu<DiagramForm>
      defaultValues={{ id: '', country: '', state: '', region: '' }}
      getValueOnEdit={(newId: string) => ({
        id: newId,
        country: store.data.diagrams[newId]?.country ?? '',
        state: store.data.diagrams[newId]?.state ?? '',
        region: store.data.diagrams[newId]?.region ?? '',
      })}
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
      // 祝日を求めるための国・州・郡の入力欄 (#86, #83)
      valueControllers={control => (
        <>
          <Controller
            name="country"
            control={control}
            render={({ field }) => <TextField label="Country" size="small" helperText="e.g., US" {...field} />}
          />
          <Controller
            name="state"
            control={control}
            render={({ field }) => <TextField label="State" size="small" helperText="e.g., la" {...field} />}
          />
          <Controller
            name="region"
            control={control}
            render={({ field }) => <TextField label="Region" size="small" helperText="e.g., no" {...field} />}
          />
        </>
      )}
      listItemButtons={id => <>
        <Tooltip title="Edit route maps" disableInteractive>
          <IconButton edge="end" onClick={() => {
            resetEditingDiagramState();
            diagramsTabPanelState.editingSectionsInDiagramId = id;
            diagramsTabPanelState.sections = JSON.parse(JSON.stringify(store.data.diagrams[id].sections)) as DiagramSection[];
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
            diagramsTabPanelState.diagramCurves = JSON.parse(JSON.stringify(store.data.diagrams[id].diagramCurves));
          }}>
            <DepartureBoardIcon />
          </IconButton>
        </Tooltip>
      </>}
      handleSubmit={((inputs, editingId) => {
        const base = editingId ? store.data.diagrams[editingId] : undefined;
        const diagram: Diagram = {
          sections: base?.sections ?? [],
          trainGroups: base?.trainGroups ?? [],
          diagramCurves: base?.diagramCurves ?? [],
          country: inputs.country,
          state: inputs.state,
          region: inputs.region,
        };

        send(socket, MessageCode.FROM_CLIENT_SET_PROP, editingId && editingId !== inputs.id ? [
          ["diagrams", inputs.id],
          diagram,
          ["diagrams", editingId],
        ] : [
          ["diagrams", inputs.id],
          diagram,
        ]);
      })}
      handleDelete={(id =>
        send(socket, MessageCode.FROM_CLIENT_DELETE_PROP, ["diagrams", id])
      )}
    />
  </Paper>;
}
