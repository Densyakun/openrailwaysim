import { proxy, useSnapshot } from "valtio";
import { Alert, Button, ButtonGroup, Paper, Stack, TextField, Typography } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RouteIcon from '@mui/icons-material/Route';
import SaveIcon from '@mui/icons-material/Save';
import { FROM_CLIENT_SET_PROP } from "@/lib/game";
import { socket } from "../Client";
import { diagramsTabPanelState, resetEditingDiagramState } from "@/lib/client/diagrams";
import EditTracksInDiagramPanel, { onUpdateTrackList } from "./EditTracksInDiagramPanel";
import { useEffect, useState } from "react";

const formState = proxy<{
  toDisplayName: string;
  toTimezone: string;
  stopOffset: string;
}>({
  toDisplayName: "",
  toTimezone: "",
  stopOffset: "",
});

export default function DiagramRouteMapEditPanel() {
  const {
    selectingRouteIndex,
    tracksIsEditing,
  } = useSnapshot(diagramsTabPanelState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
    maxHeight: "25%",
    overflow: "auto",
  }}>
    {tracksIsEditing
      ? <EditTracksInDiagramPanel />
      : 0 <= selectingRouteIndex
        ? <RoutesEditor />
        : <DiagramRouteMapEditor />}
  </Paper>;
}

function AddRoutesButton() {
  return <Button variant="contained" startIcon={<AddIcon />} onClick={() =>
    diagramsTabPanelState.routeMap.push([])
  }>
    Add routes
  </Button>;
}

function AddRouteButton() {
  return <Button variant="contained" startIcon={<AddIcon />} onClick={() =>
    diagramsTabPanelState.routeMap[diagramsTabPanelState.selectingRoutesIndex].push({
      toDisplayName: "",
      toTimezone: "",
      trackIds: [],
      stopOffset: 0,
    })
  }>
    Add route
  </Button>;
}

function DiagramRouteMapEditor() {
  const {
    editingRouteMapsInDiagramId,
    routeMap,
    selectingRoutesIndex,
  } = useSnapshot(diagramsTabPanelState);

  const [changed, setChanged] = useState(true);
  useEffect(() => setChanged(true), [routeMap]);

  const invalidRoutesIndex = routeMap.findIndex(routes => !routes.length || routes.find(route => !route.trackIds.length));

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        diagramsTabPanelState.editingRouteMapsInDiagramId = "";
        resetEditingDiagramState();
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>{
        `Edit a diagram "${editingRouteMapsInDiagramId}"`
      }</Typography>
    </Stack>
    {routeMap.length
      ? <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" gutterBottom>Editing route lists {selectingRoutesIndex + 1} / {routeMap.length}</Typography>
          <ButtonGroup variant="contained">
            <Button variant='contained' onClick={() =>
              diagramsTabPanelState.selectingRoutesIndex = selectingRoutesIndex === 0
                ? routeMap.length - 1
                : selectingRoutesIndex - 1
            }>
              {"<"}
            </Button>
            <Button variant='contained' onClick={() =>
              diagramsTabPanelState.selectingRoutesIndex = selectingRoutesIndex === routeMap.length - 1
                ? 0
                : selectingRoutesIndex + 1
            }>
              {">"}
            </Button>
          </ButtonGroup>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <AddRoutesButton />
          <Button variant="contained" onClick={() =>
            diagramsTabPanelState.selectingRouteIndex = 0
          }>
            Edit
          </Button>
        </Stack>
      </Stack>
      : <Alert
        severity="error"
        action={
          <AddRoutesButton />
        }
      >
        軌道ルートを追加してください
      </Alert>
    }
    {0 <= invalidRoutesIndex && <Alert
      severity="error"
    >
      {`Routes ${invalidRoutesIndex + 1} に軌道ルートを設定してください`}
    </Alert>
    }
    <Button variant="contained" startIcon={<SaveIcon />}
      disabled={!changed || !routeMap.length || 0 <= invalidRoutesIndex}
      onClick={() => {
        socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
          ["diagrams", editingRouteMapsInDiagramId, "routeMap"],
          routeMap
        ]]));
        setChanged(false);
      }}>
      Save
    </Button>
  </Stack>;
}

function RoutesEditor() {
  const { toDisplayName, toTimezone, stopOffset } = useSnapshot(formState, { sync: true });
  const {
    routeMap,
    selectingRoutesIndex,
    selectingRouteIndex,
  } = useSnapshot(diagramsTabPanelState);

  useEffect(() => {
    if (!routeMap[selectingRoutesIndex].length) return;
    formState.stopOffset = routeMap[selectingRoutesIndex][selectingRouteIndex].stopOffset.toString();
  }, [routeMap, selectingRouteIndex]);

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
        diagramsTabPanelState.selectingRouteIndex = -1
      }>
        Back
      </Button>
      {Boolean(routeMap[selectingRoutesIndex].length) && <>
        <Typography variant="h6" gutterBottom>Editing route {selectingRouteIndex + 1} / {routeMap[selectingRoutesIndex].length} in {selectingRoutesIndex + 1}</Typography>
        <ButtonGroup variant="contained">
          <Button variant='contained' onClick={() =>
            diagramsTabPanelState.selectingRouteIndex = selectingRouteIndex === 0
              ? routeMap[selectingRoutesIndex].length - 1
              : selectingRouteIndex - 1
          }>
            {"<"}
          </Button>
          <Button variant='contained' onClick={() =>
            diagramsTabPanelState.selectingRouteIndex = selectingRouteIndex === routeMap[selectingRoutesIndex].length - 1
              ? 0
              : selectingRouteIndex + 1
          }>
            {">"}
          </Button>
        </ButtonGroup>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>Routes: {routeMap[selectingRoutesIndex].length}</Typography>
          <AddRouteButton />
          <Button variant="contained" startIcon={<RouteIcon />} disabled={!routeMap[selectingRoutesIndex].length} onClick={() => {
            diagramsTabPanelState.tracksIsEditing = true;
            onUpdateTrackList();
          }}>
            Edit track selections
          </Button>
        </Stack>
      </>}
    </Stack>
    {routeMap[selectingRoutesIndex].length
      ? <>
        <TextField
          label="To display name"
          value={toDisplayName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.toDisplayName = event.target.value;

            diagramsTabPanelState.routeMap[selectingRoutesIndex][selectingRouteIndex].toDisplayName = event.target.value;
          }}
        />
        {!toTimezone && <Alert severity="info">
          {`タイムゾーンはデフォルトで Asia/Tokyo になります`}
        </Alert>}
        <TextField
          label="To timezone"
          value={toTimezone}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.toTimezone = event.target.value;

            diagramsTabPanelState.routeMap[selectingRoutesIndex][selectingRouteIndex].toTimezone = event.target.value;
          }}
        />
        {routeMap[selectingRoutesIndex][selectingRouteIndex].trackIds.length && <Alert severity="info">
          {`最後の軌道を選択すると Stop offset を設定できます`}
        </Alert>}
        <TextField
          label="Stop offset"
          value={stopOffset}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.stopOffset = event.target.value;
            const value = parseFloat(event.target.value);
            if (Number.isNaN(value)) return;

            diagramsTabPanelState.routeMap[selectingRoutesIndex][selectingRouteIndex].stopOffset = value;
          }}
        />
      </>
      : <Alert
        severity="error"
        action={
          <AddRouteButton />
        }
      >
        軌道ルートを追加してください
      </Alert>}
  </Stack>;
}