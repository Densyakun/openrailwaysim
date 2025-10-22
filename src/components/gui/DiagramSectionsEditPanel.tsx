import { proxy, useSnapshot } from "valtio";
import { Alert, Button, ButtonGroup, Paper, Stack, TextField, Typography } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RouteIcon from '@mui/icons-material/Route';
import SaveIcon from '@mui/icons-material/Save';
import { socket } from "../Client";
import { diagramsTabPanelState, resetEditingDiagramState } from "@/lib/client/diagrams";
import EditTracksInDiagramPanel, { onUpdateTrackList } from "./EditTracksInDiagramPanel";
import { useEffect, useState } from "react";
import { MessageCode, send } from "@/lib/ws";

const formState = proxy<{
  fromDisplayName: string;
  toDisplayName: string;
  fromTimezone: string;
  toTimezone: string;
  stopOffset: string;
  fromPlatformName: string;
  toPlatformName: string;
}>({
  fromDisplayName: "",
  toDisplayName: "",
  fromTimezone: "",
  toTimezone: "",
  stopOffset: "",
  fromPlatformName: "",
  toPlatformName: "",
});

export default function DiagramSectionsEditPanel() {
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
        ? <SectionEditor />
        : <DiagramRouteMapEditor />}
  </Paper>;
}

function AddSectionButton() {
  return <Button variant="contained" startIcon={<AddIcon />} onClick={() =>
    diagramsTabPanelState.sections.push({
      routes: [],
      fromDisplayName: "",
      toDisplayName: "",
      fromTimezone: "",
      toTimezone: "",
    })
  }>
    Add route list
  </Button>;
}

function AddRouteButton() {
  return <Button variant="contained" startIcon={<AddIcon />} onClick={() =>
    diagramsTabPanelState.sections[diagramsTabPanelState.selectingDiagramSectionIndex].routes.push({
      trackIds: [],
      stopOffset: 0,
      fromPlatformName: "",
      toPlatformName: "",
    })
  }>
    Add route
  </Button>;
}

function DiagramRouteMapEditor() {
  const { fromDisplayName, toDisplayName, fromTimezone, toTimezone } = useSnapshot(formState, { sync: true });
  const {
    editingSectionsInDiagramId,
    sections,
    selectingDiagramSectionIndex,
  } = useSnapshot(diagramsTabPanelState);

  useEffect(() => {
    if (!sections.length) return;
    const section = sections[selectingDiagramSectionIndex];
    formState.fromDisplayName = section.fromDisplayName;
    formState.toDisplayName = section.toDisplayName;
    formState.fromTimezone = section.fromTimezone;
    formState.toTimezone = section.toTimezone;
  }, [sections, selectingDiagramSectionIndex]);

  const [changed, setChanged] = useState(true);
  useEffect(() => setChanged(true), [sections]);

  const invalidSectionIndex = sections.findIndex(section => !section.routes.length || section.routes.find(route => !route.trackIds.length));

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        diagramsTabPanelState.editingSectionsInDiagramId = "";
        resetEditingDiagramState();
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>{
        `Edit a diagram "${editingSectionsInDiagramId}"`
      }</Typography>
    </Stack>
    {sections.length
      ? <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" gutterBottom>Editing route lists {selectingDiagramSectionIndex + 1} / {sections.length}</Typography>
          <ButtonGroup variant="contained">
            <Button variant='contained' onClick={() =>
              diagramsTabPanelState.selectingDiagramSectionIndex = selectingDiagramSectionIndex === 0
                ? sections.length - 1
                : selectingDiagramSectionIndex - 1
            }>
              {"<"}
            </Button>
            <Button variant='contained' onClick={() =>
              diagramsTabPanelState.selectingDiagramSectionIndex = selectingDiagramSectionIndex === sections.length - 1
                ? 0
                : selectingDiagramSectionIndex + 1
            }>
              {">"}
            </Button>
          </ButtonGroup>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <AddSectionButton />
          <Button variant="contained" disabled={!sections.length} onClick={() =>
            diagramsTabPanelState.selectingRouteIndex = 0
          }>
            Edit
          </Button>
        </Stack>
        <TextField
          label="From display name"
          value={fromDisplayName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.fromDisplayName = event.target.value;

            diagramsTabPanelState.sections[selectingDiagramSectionIndex].fromDisplayName = event.target.value;
          }}
        />
        <TextField
          label="To display name"
          value={toDisplayName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.toDisplayName = event.target.value;

            diagramsTabPanelState.sections[selectingDiagramSectionIndex].toDisplayName = event.target.value;
          }}
        />
        {!fromTimezone && !toTimezone && <Alert severity="info">
          {`タイムゾーンはデフォルトで Asia/Tokyo になります`}
        </Alert>}
        <TextField
          label="From timezone"
          value={fromTimezone}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.fromTimezone = event.target.value;

            diagramsTabPanelState.sections[selectingDiagramSectionIndex].fromTimezone = event.target.value;
          }}
        />
        <TextField
          label="To timezone"
          value={toTimezone}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.toTimezone = event.target.value;

            diagramsTabPanelState.sections[selectingDiagramSectionIndex].toTimezone = event.target.value;
          }}
        />
      </Stack>
      : <Alert
        severity="error"
        action={
          <AddSectionButton />
        }
      >
        軌道ルートを追加してください
      </Alert>
    }
    {0 <= invalidSectionIndex && <Alert
      severity="error"
    >
      {`Route list ${invalidSectionIndex + 1} に軌道ルートを設定してください`}
    </Alert>
    }
    <Button variant="contained" startIcon={<SaveIcon />}
      disabled={!changed || !sections.length || 0 <= invalidSectionIndex}
      onClick={() => {
        send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
          ["diagrams", editingSectionsInDiagramId, "sections"],
          diagramsTabPanelState.sections
        ]);
        setChanged(false);
      }}>
      Save
    </Button>
  </Stack>;
}

function SectionEditor() {
  const { fromPlatformName, toPlatformName, stopOffset } = useSnapshot(formState, { sync: true });
  const {
    sections: routeMap,
    selectingDiagramSectionIndex,
    selectingRouteIndex,
  } = useSnapshot(diagramsTabPanelState);

  const section = routeMap[selectingDiagramSectionIndex];

  useEffect(() => {
    if (!section.routes.length) return;
    formState.fromPlatformName = section.routes[selectingRouteIndex].fromPlatformName;
    formState.toPlatformName = section.routes[selectingRouteIndex].toPlatformName;
    formState.stopOffset = String(section.routes[selectingRouteIndex].stopOffset);
  }, [routeMap, selectingRouteIndex]);

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
        diagramsTabPanelState.selectingRouteIndex = -1
      }>
        Back
      </Button>
      {Boolean(section.routes.length) && <>
        <Typography variant="h6" gutterBottom>Editing route {selectingRouteIndex + 1} / {section.routes.length} in {selectingDiagramSectionIndex + 1}</Typography>
        <ButtonGroup variant="contained">
          <Button variant='contained' disabled={!section.routes.length} onClick={() =>
            diagramsTabPanelState.selectingRouteIndex = selectingRouteIndex === 0
              ? section.routes.length - 1
              : selectingRouteIndex - 1
          }>
            {"<"}
          </Button>
          <Button variant='contained' disabled={!section.routes.length} onClick={() =>
            diagramsTabPanelState.selectingRouteIndex = selectingRouteIndex === section.routes.length - 1
              ? 0
              : selectingRouteIndex + 1
          }>
            {">"}
          </Button>
        </ButtonGroup>
        <Stack direction="row" spacing={1} alignItems="center">
          <AddRouteButton />
          <Button variant="contained" startIcon={<RouteIcon />} disabled={!section.routes.length} onClick={() => {
            diagramsTabPanelState.tracksIsEditing = true;
            onUpdateTrackList();
          }}>
            Edit track selections
          </Button>
        </Stack>
      </>}
    </Stack>
    {section.routes.length
      ? <>
        {section.routes[selectingRouteIndex].trackIds.length === 1 && <Alert severity="info">
          {`軌道が1つしかない軌道ルートでは、列車が通過できません`}
        </Alert>}
        <TextField
          label="From platform name"
          value={fromPlatformName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.fromPlatformName = event.target.value;

            diagramsTabPanelState.sections[selectingDiagramSectionIndex].routes[selectingRouteIndex].fromPlatformName = event.target.value;
          }}
        />
        <TextField
          label="To platform name"
          value={toPlatformName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.toPlatformName = event.target.value;

            diagramsTabPanelState.sections[selectingDiagramSectionIndex].routes[selectingRouteIndex].toPlatformName = event.target.value;
          }}
        />
        {0 < routeMap[selectingDiagramSectionIndex].routes[selectingRouteIndex].trackIds.length && <Alert severity="info">
          {`最後の軌道を選択すると Stop offset を設定できます`}
        </Alert>}
        <TextField
          label="Stop offset"
          value={stopOffset}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            formState.stopOffset = event.target.value;
            const value = parseFloat(event.target.value);
            if (Number.isNaN(value)) return;

            diagramsTabPanelState.sections[selectingDiagramSectionIndex].routes[selectingRouteIndex].stopOffset = value;
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