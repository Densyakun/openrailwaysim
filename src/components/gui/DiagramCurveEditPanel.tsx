import { proxy, useSnapshot } from "valtio";
import { Alert, Button, ButtonGroup, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { FROM_CLIENT_SET_PROP } from "@/lib/game";
import { socket } from "../Client";
import { diagramsTabPanelState, resetEditingDiagramState } from "@/lib/client/diagrams";
import { useEffect, useState } from "react";
import { gameState } from "@/lib/client";
import { TIME_IS_NOT_SET } from "@/lib/diagram";

const formState = proxy<{
  scheduledRouteIndex: string;
  passTime: string;
  stopTime: string;
  isPasses: boolean;
}>({
  scheduledRouteIndex: "",
  passTime: "",
  stopTime: "",
  isPasses: false,
});

export default function DiagramCurveEditPanel() {
  const {
    selectingRouteListIndexInDiagramCurve,
  } = useSnapshot(diagramsTabPanelState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
    maxHeight: "25%",
    overflow: "auto",
  }}>
    {0 <= selectingRouteListIndexInDiagramCurve
      ? <SectionEditor />
      : <DiagramCurveEditor />}
  </Paper>;
}

function AddCurveButton() {
  return <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
    const stations = gameState.data.diagrams[diagramsTabPanelState.editingDiagramCurvesInDiagramId].routeMap.length;
    diagramsTabPanelState.diagramCurves.push({
      scheduledRouteIndexes: [...Array(stations)].map(_ => -1),
      passTime: [...Array(stations)].map(_ => TIME_IS_NOT_SET),
      stopTime: [...Array(stations)].map(_ => TIME_IS_NOT_SET),
      isPasses: [...Array(stations)].map(_ => false),
    });
  }}>
    Add
  </Button>;
}

function DiagramCurveEditor() {
  const {
    editingDiagramCurvesInDiagramId,
    diagramCurves,
    selectingDiagramCurveIndex,
  } = useSnapshot(diagramsTabPanelState);

  const [changed, setChanged] = useState(true);
  useEffect(() => setChanged(true), [diagramCurves]);

  //const invalidRouteListIndex = routeMap.findIndex(routeList => !routeList.length || routeList.find(route => !route.trackIds.length));

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        diagramsTabPanelState.editingDiagramCurvesInDiagramId = "";
        resetEditingDiagramState();
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>{
        `Edit a diagram curve "${editingDiagramCurvesInDiagramId}"`
      }</Typography>
      <Button variant="contained" startIcon={<SaveIcon />}
        disabled={!changed/* || 0 <= invalidRouteListIndex*/}
        onClick={() => {
          socket.send(JSON.stringify([FROM_CLIENT_SET_PROP, [
            ["diagrams", editingDiagramCurvesInDiagramId, "diagramCurves"],
            diagramCurves
          ]]));
          setChanged(false);
        }}>
        Save
      </Button>
    </Stack>
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h6" gutterBottom>Editing diagram curve {selectingDiagramCurveIndex + 1} / {diagramCurves.length}</Typography>
        <ButtonGroup variant="contained">
          <Button variant='contained' disabled={!diagramCurves.length} onClick={() =>
            diagramsTabPanelState.selectingDiagramCurveIndex = selectingDiagramCurveIndex <= 0
              ? diagramCurves.length - 1
              : selectingDiagramCurveIndex - 1
          }>
            {"<"}
          </Button>
          <Button variant='contained' disabled={!diagramCurves.length} onClick={() =>
            diagramsTabPanelState.selectingDiagramCurveIndex = diagramCurves.length - 1 <= selectingDiagramCurveIndex
              ? 0
              : selectingDiagramCurveIndex + 1
          }>
            {">"}
          </Button>
        </ButtonGroup>
        <AddCurveButton />
        <Button variant="contained" disabled={!diagramCurves.length} onClick={() =>
          diagramsTabPanelState.selectingRouteListIndexInDiagramCurve = 0
        }>
          Edit
        </Button>
      </Stack>
    </Stack>
    {/*0 <= invalidRouteListIndex && <Alert
      severity="error"
    >
      {`Route list ${invalidRouteListIndex + 1} に軌道ルートを設定してください`}
    </Alert>
    */}
  </Stack>;
}

function SectionEditor() {
  const { scheduledRouteIndex, passTime, stopTime, isPasses } = useSnapshot(formState, { sync: true });
  const {
    diagramCurves,
    selectingDiagramCurveIndex,
    selectingRouteListIndexInDiagramCurve,
  } = useSnapshot(diagramsTabPanelState);

  useEffect(() => {
    const diagramCurve = diagramCurves[selectingDiagramCurveIndex];
    //if (!diagramCurve.scheduledRouteIndexes.length) return;
    formState.scheduledRouteIndex = diagramCurve.scheduledRouteIndexes[selectingRouteListIndexInDiagramCurve].toString();
    formState.passTime = diagramCurve.passTime[selectingRouteListIndexInDiagramCurve].toString();
    formState.stopTime = diagramCurve.stopTime[selectingRouteListIndexInDiagramCurve].toString();
    formState.isPasses = diagramCurve.isPasses[selectingRouteListIndexInDiagramCurve];
  }, [diagramCurves, selectingDiagramCurveIndex, selectingRouteListIndexInDiagramCurve]);

  const diagramCurve = diagramsTabPanelState.diagramCurves[selectingDiagramCurveIndex];

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
        diagramsTabPanelState.selectingRouteListIndexInDiagramCurve = -1
      }>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing section {selectingRouteListIndexInDiagramCurve + 1} / {diagramCurves[selectingDiagramCurveIndex].passTime.length} in {selectingDiagramCurveIndex + 1}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() =>
          diagramsTabPanelState.selectingRouteListIndexInDiagramCurve = selectingRouteListIndexInDiagramCurve === 0
            ? diagramCurves[selectingDiagramCurveIndex].passTime.length - 1
            : selectingRouteListIndexInDiagramCurve - 1
        }>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() =>
          diagramsTabPanelState.selectingRouteListIndexInDiagramCurve = selectingRouteListIndexInDiagramCurve === diagramCurves[selectingDiagramCurveIndex].passTime.length - 1
            ? 0
            : selectingRouteListIndexInDiagramCurve + 1
        }>
          {">"}
        </Button>
      </ButtonGroup>
    </Stack>
    {/** TODO 駅名、番線を表示 */}
    {/*<Typography variant="h6" gutterBottom>{`${trackRoute.toDisplayName ? `"${trackRoute.toDisplayName}"` : `(${train.currentRouteListIndex}, ${train.currentRouteIndex})`}:`}</Typography>*/}
    <TextField
      label="Pass time"
      value={passTime}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.passTime = event.target.value;
        const value = parseInt(event.target.value);
        if (Number.isNaN(value)) return;

        diagramCurve.passTime[selectingRouteListIndexInDiagramCurve] = value;
      }}
    />
    <TextField
      label="Stop time"
      value={stopTime}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.stopTime = event.target.value;
        const value = parseInt(event.target.value);
        if (Number.isNaN(value)) return;

        diagramCurve.stopTime[selectingRouteListIndexInDiagramCurve] = value;
      }}
    />
    <TextField
      label="Scheduled route index"
      value={scheduledRouteIndex}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.scheduledRouteIndex = event.target.value;
        const value = parseInt(event.target.value);
        if (Number.isNaN(value)) return;

        diagramCurve.scheduledRouteIndexes[selectingRouteListIndexInDiagramCurve] = value;
      }}
    />
    {selectingRouteListIndexInDiagramCurve === diagramCurve.passTime.length - 1 && <Alert severity="info">
      {`終点は通過できません`}
    </Alert>}
    <FormControlLabel control={<Checkbox size="small" checked={isPasses} disabled={selectingRouteListIndexInDiagramCurve === diagramCurve.passTime.length - 1} onChange={event => {
      diagramCurve.isPasses[selectingRouteListIndexInDiagramCurve] =
        formState.isPasses = event.target.checked;
    }} />} label="is passes" />
  </Stack>;
}