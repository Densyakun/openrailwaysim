import { proxy, useSnapshot } from "valtio";
import { Alert, Button, ButtonGroup, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { socket } from "../Client";
import { diagramsTabPanelState, resetEditingDiagramState } from "@/lib/client/diagrams";
import { useEffect, useState } from "react";
import { gameState } from "@/lib/client/client";
import { TIME_IS_NOT_SET } from "@/lib/diagram";
import { MessageCode, send } from "@/lib/ws";

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
    selectingDiagramSectionIndexInDiagramCurve,
  } = useSnapshot(diagramsTabPanelState);

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
    maxHeight: "25%",
    overflow: "auto",
  }}>
    {0 <= selectingDiagramSectionIndexInDiagramCurve
      ? <SectionEditor />
      : <DiagramCurveEditor />}
  </Paper>;
}

function AddCurveButton() {
  return <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
    const stations = gameState.data.diagrams[diagramsTabPanelState.editingDiagramCurvesInDiagramId].sections.length;
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

  //const invalidSectionIndex = sections.findIndex(section => !section.length || section.find(route => !route.trackIds.length));

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
        disabled={!changed/* || 0 <= invalidSectionIndex*/}
        onClick={() => {
          send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
            ["diagrams", editingDiagramCurvesInDiagramId, "diagramCurves"],
            diagramsTabPanelState.diagramCurves
          ]);
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
          diagramsTabPanelState.selectingDiagramSectionIndexInDiagramCurve = 0
        }>
          Edit
        </Button>
      </Stack>
    </Stack>
    {/*0 <= invalidSectionIndex && <Alert
      severity="error"
    >
      {`Route list ${invalidSectionIndex + 1} に軌道ルートを設定してください`}
    </Alert>
    */}
  </Stack>;
}

function SectionEditor() {
  const { diagrams } = useSnapshot(gameState.data);
  const { scheduledRouteIndex, passTime, stopTime, isPasses } = useSnapshot(formState, { sync: true });
  const {
    diagramCurves,
    editingDiagramCurvesInDiagramId,
    selectingDiagramCurveIndex,
    selectingDiagramSectionIndexInDiagramCurve,
  } = useSnapshot(diagramsTabPanelState);

  useEffect(() => {
    const diagramCurve = diagramCurves[selectingDiagramCurveIndex];
    //if (!diagramCurve.scheduledRouteIndexes.length) return;
    formState.scheduledRouteIndex = diagramCurve.scheduledRouteIndexes[selectingDiagramSectionIndexInDiagramCurve].toString();
    formState.passTime = diagramCurve.passTime[selectingDiagramSectionIndexInDiagramCurve].toString();
    formState.stopTime = diagramCurve.stopTime[selectingDiagramSectionIndexInDiagramCurve].toString();
    formState.isPasses = diagramCurve.isPasses[selectingDiagramSectionIndexInDiagramCurve];
  }, [diagramCurves, selectingDiagramCurveIndex, selectingDiagramSectionIndexInDiagramCurve]);

  const diagramCurve = diagramsTabPanelState.diagramCurves[selectingDiagramCurveIndex];
  const section = diagrams[editingDiagramCurvesInDiagramId].sections[selectingDiagramSectionIndexInDiagramCurve];

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
        diagramsTabPanelState.selectingDiagramSectionIndexInDiagramCurve = -1
      }>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing section {selectingDiagramSectionIndexInDiagramCurve + 1} / {diagramCurves[selectingDiagramCurveIndex].passTime.length} in {selectingDiagramCurveIndex + 1}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() =>
          diagramsTabPanelState.selectingDiagramSectionIndexInDiagramCurve = selectingDiagramSectionIndexInDiagramCurve === 0
            ? diagramCurves[selectingDiagramCurveIndex].passTime.length - 1
            : selectingDiagramSectionIndexInDiagramCurve - 1
        }>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() =>
          diagramsTabPanelState.selectingDiagramSectionIndexInDiagramCurve = selectingDiagramSectionIndexInDiagramCurve === diagramCurves[selectingDiagramCurveIndex].passTime.length - 1
            ? 0
            : selectingDiagramSectionIndexInDiagramCurve + 1
        }>
          {">"}
        </Button>
      </ButtonGroup>
    </Stack>
    <Typography variant="h6" gutterBottom>{`"${section.fromDisplayName}"`}</Typography>
    <TextField
      label="Pass time"
      value={passTime}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.passTime = event.target.value;
        const value = parseInt(event.target.value);
        if (Number.isNaN(value)) return;

        diagramCurve.passTime[selectingDiagramSectionIndexInDiagramCurve] = value;
      }}
    />
    <Typography variant="h6" gutterBottom>{`"${section.toDisplayName}"`}</Typography>
    <TextField
      label="Stop time"
      value={stopTime}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.stopTime = event.target.value;
        const value = parseInt(event.target.value);
        if (Number.isNaN(value)) return;

        diagramCurve.stopTime[selectingDiagramSectionIndexInDiagramCurve] = value;
      }}
    />
    <TextField
      label="Scheduled route index"
      value={scheduledRouteIndex}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.scheduledRouteIndex = event.target.value;
        const value = parseInt(event.target.value);
        if (Number.isNaN(value)) return;

        diagramCurve.scheduledRouteIndexes[selectingDiagramSectionIndexInDiagramCurve] = value;
      }}
    />
    {0 <= diagramCurve.scheduledRouteIndexes[selectingDiagramSectionIndexInDiagramCurve] && diagramCurve.scheduledRouteIndexes[selectingDiagramSectionIndexInDiagramCurve] < section.routes.length &&
      <Typography variant="h6" gutterBottom>
        {`"${section.routes[diagramCurve.scheduledRouteIndexes[selectingDiagramSectionIndexInDiagramCurve]].toPlatformName}"`}
      </Typography>
    }
    {selectingDiagramSectionIndexInDiagramCurve === diagramCurve.passTime.length - 1 && <Alert severity="info">
      {`終点は通過できません`}
    </Alert>}
    <FormControlLabel control={<Checkbox size="small" checked={isPasses} disabled={selectingDiagramSectionIndexInDiagramCurve === diagramCurve.passTime.length - 1} onChange={event => {
      diagramCurve.isPasses[selectingDiagramSectionIndexInDiagramCurve] =
        formState.isPasses = event.target.checked;
    }} />} label="is passes" />
  </Stack>;
}