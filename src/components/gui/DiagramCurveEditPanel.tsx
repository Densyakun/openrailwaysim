import { proxy, useSnapshot } from "valtio";
import { Button, ButtonGroup, Paper, Stack, TextField, Typography } from "@mui/material";
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
  isPasses: string;
}>({
  scheduledRouteIndex: "",
  passTime: "",
  stopTime: "",
  isPasses: "",
});

export default function DiagramCurveEditPanel() {
  const {
    selectingStationIndex,
  } = useSnapshot(diagramsTabPanelState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
    maxHeight: "25%",
    overflow: "auto",
  }}>
    {0 <= selectingStationIndex
      ? <StationEditor />
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

  //const invalidRoutesIndex = routeMap.findIndex(routes => !routes.length || routes.find(route => !route.trackIds.length));

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
        disabled={!changed/* || 0 <= invalidRoutesIndex*/}
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
        <Typography variant="h6" gutterBottom>Editing diagram curves {selectingDiagramCurveIndex + 1} / {diagramCurves.length}</Typography>
        <ButtonGroup variant="contained">
          <Button variant='contained' onClick={() =>
            diagramsTabPanelState.selectingDiagramCurveIndex = selectingDiagramCurveIndex <= 0
              ? diagramCurves.length - 1
              : selectingDiagramCurveIndex - 1
          }>
            {"<"}
          </Button>
          <Button variant='contained' onClick={() =>
            diagramsTabPanelState.selectingDiagramCurveIndex = diagramCurves.length - 1 <= selectingDiagramCurveIndex
              ? 0
              : selectingDiagramCurveIndex + 1
          }>
            {">"}
          </Button>
        </ButtonGroup>
        <AddCurveButton />
        <Button variant="contained" onClick={() =>
          diagramsTabPanelState.selectingStationIndex = 0
        }>
          Edit
        </Button>
      </Stack>
    </Stack>
    {/*0 <= invalidRoutesIndex && <Alert
      severity="error"
    >
      {`Routes ${invalidRoutesIndex + 1} に軌道ルートを設定してください`}
    </Alert>
    */}
  </Stack>;
}

function StationEditor() {
  const { scheduledRouteIndex, passTime, stopTime, isPasses } = useSnapshot(formState, { sync: true });
  const {
    diagramCurves,
    selectingDiagramCurveIndex,
    selectingStationIndex,
  } = useSnapshot(diagramsTabPanelState);

  useEffect(() => {
    const diagramCurve = diagramCurves[selectingDiagramCurveIndex];
    //if (!diagramCurve.scheduledRouteIndexes.length) return;
    formState.scheduledRouteIndex = selectingStationIndex === 0 ? "" : diagramCurve.scheduledRouteIndexes[selectingStationIndex - 1].toString();
    formState.passTime = selectingStationIndex === diagramCurve.scheduledRouteIndexes.length ? "" : diagramCurve.passTime[selectingStationIndex].toString();
    formState.stopTime = selectingStationIndex === 0 ? "" : diagramCurve.stopTime[selectingStationIndex - 1].toString();
    formState.isPasses = selectingStationIndex === 0 ? "" : diagramCurve.isPasses[selectingStationIndex - 1].toString();
  }, [diagramCurves, selectingDiagramCurveIndex, selectingStationIndex]);

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
        diagramsTabPanelState.selectingStationIndex = -1
      }>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing station {selectingStationIndex + 1} / {diagramCurves[selectingDiagramCurveIndex].scheduledRouteIndexes.length + 1} in {selectingDiagramCurveIndex + 1}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() =>
          diagramsTabPanelState.selectingStationIndex = selectingStationIndex === 0
            ? diagramCurves[selectingDiagramCurveIndex].scheduledRouteIndexes.length
            : selectingStationIndex - 1
        }>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() =>
          diagramsTabPanelState.selectingStationIndex = selectingStationIndex === diagramCurves[selectingDiagramCurveIndex].scheduledRouteIndexes.length
            ? 0
            : selectingStationIndex + 1
        }>
          {">"}
        </Button>
      </ButtonGroup>
    </Stack>
    {selectingStationIndex !== diagramCurves[selectingDiagramCurveIndex].scheduledRouteIndexes.length && <TextField
      label="Pass time"
      value={passTime}
      disabled={selectingStationIndex === diagramCurves[selectingDiagramCurveIndex].scheduledRouteIndexes.length}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.passTime = event.target.value;
        const value = parseInt(event.target.value);
        if (Number.isNaN(value)) return;

        diagramsTabPanelState.diagramCurves[selectingDiagramCurveIndex].passTime[selectingStationIndex] = value;
      }}
    />}
    {selectingStationIndex !== 0 && <>
      <TextField
        label="Stop time"
        value={stopTime}
        disabled={selectingStationIndex === 0}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.stopTime = event.target.value;
          const value = parseInt(event.target.value);
          if (Number.isNaN(value)) return;

          diagramsTabPanelState.diagramCurves[selectingDiagramCurveIndex].stopTime[selectingStationIndex - 1] = value;
        }}
      />
      <TextField
        label="Scheduled route index"
        value={scheduledRouteIndex}
        disabled={selectingStationIndex === 0}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.scheduledRouteIndex = event.target.value;
          const value = parseInt(event.target.value);
          if (Number.isNaN(value)) return;

          diagramsTabPanelState.diagramCurves[selectingDiagramCurveIndex].scheduledRouteIndexes[selectingStationIndex - 1] = value;
        }}
      />
    </>}
    {/** TODO 通過設定 */}
  </Stack>;
}