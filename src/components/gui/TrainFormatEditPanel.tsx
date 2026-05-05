import * as THREE from "three";
import { proxy, useSnapshot } from "valtio";
import { Alert, Button, ButtonGroup, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography, List, ListItem, ListItemSecondaryAction } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { resetEditingTrainState, trainsTabPanelState } from "@/lib/client/trains";
import { useEffect, useState } from "react";
import UIOneHandleMasterControllerConfigTable from "./UIOneHandleMasterControllerConfigTable";
import { serialize, store, trainFormatTypeId, Path, SerializableORSAppDataType } from "@/lib/game";
import { v4 as uuidv4 } from 'uuid';
import { socket } from "../Client";
import { MessageCode, send } from "@/lib/ws";
import { createStandardTrainFormat, StandardCarFormat, getJNR103SeriesStandardData, convertTrainFormatToStandard } from "@/lib/trainExamples";

export const formState = proxy<{
  newTrainFormatId: string;
  carBodyOffset: string;
  carBodyWeight: string;
  axleZ: string;
  diameter: string;
  hasMotor: boolean;
  hasCab: boolean;
  directionIsReversed: boolean;
  oneHandleMasterControllerUIConfigId: string;
  jointAPositionX: string;
  jointAPositionY: string;
  jointAPositionZ: string;
  jointBPositionX: string;
  jointBPositionY: string;
  jointBPositionZ: string;
  editingTrainFormatMode: "advanced" | "standard";
  standardCarFormats: StandardCarFormat[];
  standardCarFormatIndexes: number[];
  standardMasterControllerUIOptionId: string;
}>({
  newTrainFormatId: "",
  carBodyOffset: "",
  carBodyWeight: "",
  axleZ: String(0),
  diameter: String(0.86),
  hasMotor: true,
  hasCab: false,
  directionIsReversed: false,
  oneHandleMasterControllerUIConfigId: "",
  jointAPositionX: "",
  jointAPositionY: "",
  jointAPositionZ: "",
  jointBPositionX: "",
  jointBPositionY: "",
  jointBPositionZ: "",
  editingTrainFormatMode: "advanced",
  standardCarFormats: [],
  standardCarFormatIndexes: [],
  standardMasterControllerUIOptionId: "",
});

function focusCamera() {
  /*if (!Object.keys(store.data.tracks).length) return;
  if (!trainsTabPanelState.editingTrain) return;

  if (0 <= trainsTabPanelState.selectedCarBodyIndex) {
    // To carbody
    const selectedBody = trainsTabPanelState.selectedCarBodyIndex < trainsTabPanelState.editingTrain.bogies.length
      ? trainsTabPanelState.editingTrain.bogies[trainsTabPanelState.selectedCarBodyIndex]
      : trainsTabPanelState.editingTrain.otherBodies[trainsTabPanelState.selectedCarBodyIndex - trainsTabPanelState.editingTrain.bogies.length];
    setCameraTargetPosition(selectedBody.position);
  } else if (trainsTabPanelState.pointOnTrack) {
    // To train
    const track = store.data.tracks[trainsTabPanelState.pointOnTrack.trackId];
    const position = getPosition(track, trainsTabPanelState.pointOnTrack.length);
    setCameraTargetPosition(position);
  }*/
}

function updateEditingTrainFormat() {
  const {
    editingTrainFormat,
  } = trainsTabPanelState;

  if (!Object.keys(store.data.tracks).length) return;
  if (!editingTrainFormat) return;

  // TODO 実際の軌道とは異なる場所に設置
  /*const { train, isDeadEnd } = placeTrain(
    editingTrainFormat,
    pointOnTrack,
    directionIsReversed,
  );

  trainsTabPanelState.trainIsDeadEnd = isDeadEnd;*/

  //return trainsTabPanelState.editingTrainFormat = trainFormat;
  return trainsTabPanelState.editingTrainFormat;
}

function saveEditingTrainFormat() {
  const {
    editingTrainFormatId,
    newTrainFormatId,
    editingTrainFormat,
    selectedTrainGroup,
    isAddingTrainFormat,
  } = trainsTabPanelState;

  if (!editingTrainFormat) return;

  // Add new train
  if (isAddingTrainFormat && Object.keys(store.data.trainFormats).includes(newTrainFormatId))
    return;

  const targetId = newTrainFormatId || editingTrainFormatId || uuidv4();
  const serializedTrainFormat = serialize(trainFormatTypeId, editingTrainFormat);

  // If renaming, specify oldPath to server
  const oldPath: Path<SerializableORSAppDataType> | undefined = (editingTrainFormatId && editingTrainFormatId !== targetId)
    ? ["trainFormats", editingTrainFormatId]
    : undefined;

  const messages: any[] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    [MessageCode.FROM_CLIENT_SET_PROP, [["trainFormats", targetId], serializedTrainFormat, oldPath]],
  ];

  if (isAddingTrainFormat && selectedTrainGroup && store.data.trainGroups[selectedTrainGroup]) {
    const trainGroup = [...store.data.trainGroups[selectedTrainGroup]];
    trainGroup.push(targetId);
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [["trainGroups", selectedTrainGroup], trainGroup]]);
  }

  if (messages.length > 1) {
    send(socket, MessageCode.FROM_CLIENT_MESSAGES, messages as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  } else {
    send(socket, MessageCode.FROM_CLIENT_SET_PROP, messages[0][1] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  trainsTabPanelState.isAddingTrainFormat = false;
  resetEditingTrainState();
}

export default function TrainFormatEditPanel() {
  const {
    editingTrainFormat,
    selectedCarBodyIndex,
    selectedBodySupporterJointIndex,
    selectedOtherJointIndex,
    directionIsReversed,
    trainIsDeadEnd,
  } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    updateEditingTrainFormat();
  }, [
    editingTrainFormat,
    directionIsReversed,
  ]);

  useEffect(() => {
    focusCamera();
  }, [editingTrainFormat]);

  if (!editingTrainFormat) return null;

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
    width: 400,
    maxHeight: '100%',
    overflowY: 'auto',
  }}>
    {selectedCarBodyIndex !== -1
      ? selectedCarBodyIndex < editingTrainFormat.bogies.length
        ? <BogiesEditor />
        : <OtherBodiesEditor />
      : selectedBodySupporterJointIndex !== -1
        ? <BodySupporterJointsEditor />
        : selectedOtherJointIndex !== -1
          ? <OtherJointsEditor />
          : <TrainFormatEditor trainIsDeadEnd={trainIsDeadEnd} />}
  </Paper>;
}

function AddBogieButton() {
  return <Button variant="contained" onClick={() => {
    if (!trainsTabPanelState.editingTrainFormat) return;

    trainsTabPanelState.editingTrainFormat.bogies.push({
      axles: [],
      offset: 0,
      weight: 0,
    });
  }}>
    Add bogie
  </Button>;
}

function AddAxleButton() {
  return <Button variant="contained" onClick={() => {
    if (!trainsTabPanelState.editingTrainFormat) return;

    trainsTabPanelState.editingTrainFormat.bogies[trainsTabPanelState.selectedCarBodyIndex].axles.push({
      z: 0,
      diameter: 0.86,
      hasMotor: true,
    });
  }}>
    Add axle
  </Button>;
}

function AddOtherBodyButton() {
  return <Button variant="contained" onClick={() => {
    if (!trainsTabPanelState.editingTrainFormat) return;

    trainsTabPanelState.editingTrainFormat.otherBodyOffsets.push(0);
    trainsTabPanelState.editingTrainFormat.otherBodyWeights.push(0);
    trainsTabPanelState.editingTrainFormat.cabFormats.push(null);
  }}>
    Add otherbody
  </Button>;
}

function AddBodySupporterJointButton() {
  return <Button variant="contained" onClick={() =>
    trainsTabPanelState.editingTrainFormat &&
    trainsTabPanelState.editingTrainFormat.bodySupporterJoints.push({
      otherBodyIndex: -1,
      otherBodyPosition: new THREE.Vector3(),
      bogieIndex: -1,
      bogiePosition: new THREE.Vector3(),
    })
  }>
    Add body supporter joint
  </Button>;
}

function AddOtherJointButton() {
  return <Button variant="contained" onClick={() =>
    trainsTabPanelState.editingTrainFormat &&
    trainsTabPanelState.editingTrainFormat.otherJoints.push({
      bodyIndexA: -1,
      positionA: new THREE.Vector3(),
      bodyIndexB: -1,
      positionB: new THREE.Vector3(),
    })
  }>
    Add other joint
  </Button>;
}

function updateEditingTrainFormatFromStandard() {
  const { standardCarFormats, standardCarFormatIndexes, standardMasterControllerUIOptionId } = formState;
  const trainFormat = createStandardTrainFormat(
    [...standardCarFormats],
    [...standardCarFormatIndexes],
    standardMasterControllerUIOptionId
  );
  trainsTabPanelState.editingTrainFormat = trainFormat;
}

function StandardCarFormatEditor({ index }: { index: number }) {
  const { standardCarFormats } = useSnapshot(formState);
  const carFormat = standardCarFormats[index];

  return <Stack spacing={1} sx={{ p: 1, border: '1px solid #ccc', borderRadius: 1 }}>
    <Typography variant="subtitle2">Car template {index + 1}</Typography>
    <TextField label="Length" type="number" size="small" value={carFormat.carLength} onChange={e => {
      formState.standardCarFormats[index].carLength = parseFloat(e.target.value) || 0;
      updateEditingTrainFormatFromStandard();
    }} />
    <TextField label="Weight" type="number" size="small" value={carFormat.carWeight} onChange={e => {
      formState.standardCarFormats[index].carWeight = parseFloat(e.target.value) || 0;
      updateEditingTrainFormatFromStandard();
    }} />
    <TextField label="Coupler offset (Front)" type="number" size="small" value={carFormat.couplerJointOffset} onChange={e => {
      formState.standardCarFormats[index].couplerJointOffset = parseFloat(e.target.value) || 0;
      updateEditingTrainFormatFromStandard();
    }} />
    <TextField label="Coupler offset (Rear)" type="number" size="small" value={carFormat.couplerJointOffset1} onChange={e => {
      formState.standardCarFormats[index].couplerJointOffset1 = parseFloat(e.target.value) || 0;
      updateEditingTrainFormatFromStandard();
    }} />
    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
      formState.standardCarFormats.splice(index, 1);
      // Adjust indexes
      formState.standardCarFormatIndexes = formState.standardCarFormatIndexes.map(i => i >= index ? Math.max(0, i - 1) : i);
      updateEditingTrainFormatFromStandard();
    }}>Delete template</Button>
  </Stack>;
}

function StandardModeEditor() {
  const { standardCarFormats, standardCarFormatIndexes, standardMasterControllerUIOptionId } = useSnapshot(formState);
  const { uiOneHandleMasterControllerConfigs } = useSnapshot(store.data);
  const { isShowOneHandleMasterControllerConfig } = useSnapshot(trainsTabPanelState);

  return <Stack spacing={2}>
    <Button variant="outlined" onClick={() => {
      const { carFormats, carFormatIndexes } = getJNR103SeriesStandardData();
      formState.standardCarFormats = [...carFormats];
      formState.standardCarFormatIndexes = [...carFormatIndexes];
      updateEditingTrainFormatFromStandard();
    }}>Apply JNR 103 Series template</Button>
    <Typography variant="h6">Car templates</Typography>
    <Stack spacing={1}>
      {standardCarFormats.map((_, index) => <StandardCarFormatEditor key={index} index={index} />)}
      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => {
        formState.standardCarFormats.push({
          carLength: 20,
          bogies: [
            { offset: -7, axles: [{ z: -1.15, diameter: 0.86, hasMotor: true }, { z: 1.15, diameter: 0.86, hasMotor: true }], weight: 0 },
            { offset: 7, axles: [{ z: -1.15, diameter: 0.86, hasMotor: true }, { z: 1.15, diameter: 0.86, hasMotor: true }], weight: 0 }
          ],
          carWeight: 30,
          couplerJointOffset: 0.5,
          couplerJointOffset1: 0.5
        });
        updateEditingTrainFormatFromStandard();
      }}>Add template</Button>
    </Stack>

    <Typography variant="h6">Formation</Typography>
    <List dense>
      {standardCarFormatIndexes.map((carIndex, i) => (
        <ListItem key={i}>
          <Typography sx={{ mr: 2 }}>{i + 1}:</Typography>
          <Select
            size="small"
            value={carIndex}
            onChange={e => {
              formState.standardCarFormatIndexes[i] = e.target.value as number;
              updateEditingTrainFormatFromStandard();
            }}
          >
            {standardCarFormats.map((_, idx) => <MenuItem key={idx} value={idx}>Template {idx + 1}</MenuItem>)}
          </Select>
          <ListItemSecondaryAction>
            <IconButton size="small" onClick={() => {
              formState.standardCarFormatIndexes.splice(i, 1);
              updateEditingTrainFormatFromStandard();
            }}>
              <DeleteIcon />
            </IconButton>
          </ListItemSecondaryAction>
        </ListItem>
      ))}
    </List>
    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => {
      formState.standardCarFormatIndexes.push(0);
      updateEditingTrainFormatFromStandard();
    }}>Add car to formation</Button>

    <Stack direction="row" spacing={1} alignItems="center">
      <FormControl fullWidth>
        <InputLabel id="standard-master-controller-select-label">Master controller</InputLabel>
        <Select
          labelId="standard-master-controller-select-label"
          value={standardMasterControllerUIOptionId}
          label="Master controller"
          onChange={e => {
            formState.standardMasterControllerUIOptionId = e.target.value as string;
            updateEditingTrainFormatFromStandard();
          }}
        >
          {Object.keys(uiOneHandleMasterControllerConfigs).map(id =>
            <MenuItem key={id} value={id}>{id}</MenuItem>
          )}
        </Select>
      </FormControl>
      <IconButton color="primary" onClick={() => trainsTabPanelState.isShowOneHandleMasterControllerConfig = true}>
        <TuneIcon />
      </IconButton>
      <Drawer anchor="right" open={isShowOneHandleMasterControllerConfig} onClose={() => trainsTabPanelState.isShowOneHandleMasterControllerConfig = false}>
        <Stack sx={{ width: 480 }}>
          <UIOneHandleMasterControllerConfigTable />
        </Stack>
      </Drawer>
    </Stack>
  </Stack>;
}

function TrainFormatEditor({ trainIsDeadEnd }: { trainIsDeadEnd: boolean }) {
  const {
    isAddingTrainFormat,
    editingTrainFormatId,
    newTrainFormatId,
    editingTrainFormat,
  } = trainsTabPanelState;

  const { newTrainFormatId: newTrainFormatIdValue, editingTrainFormatMode } = useSnapshot(formState, { sync: true });
  const { trainFormats, uiOneHandleMasterControllerConfigs } = useSnapshot(store.data);
  const [openConfirmStandard, setOpenConfirmStandard] = useState(false);

  useEffect(() => {
    focusCamera();
    formState.newTrainFormatId = newTrainFormatId;
    const initialMode = isAddingTrainFormat ? "standard" : "advanced";
    formState.editingTrainFormatMode = initialMode;

    if (editingTrainFormat) {
      const { carFormats, carFormatIndexes, masterControllerUIOptionId } = convertTrainFormatToStandard(editingTrainFormat);
      if (carFormats.length > 0) {
        formState.standardCarFormats = [...carFormats];
        formState.standardCarFormatIndexes = [...carFormatIndexes];
        if (masterControllerUIOptionId) {
          formState.standardMasterControllerUIOptionId = masterControllerUIOptionId;
        }
      } else if (isAddingTrainFormat) {
        // Default car for new format in Standard Mode
        formState.standardCarFormats = [{
          carLength: 20,
          bogies: [
            { offset: -7, axles: [{ z: -1.15, diameter: 0.86, hasMotor: true }, { z: 1.15, diameter: 0.86, hasMotor: true }], weight: 0 },
            { offset: 7, axles: [{ z: -1.15, diameter: 0.86, hasMotor: true }, { z: 1.15, diameter: 0.86, hasMotor: true }], weight: 0 }
          ],
          carWeight: 30,
          couplerJointOffset: 0.5,
          couplerJointOffset1: 0.5
        }];
        formState.standardCarFormatIndexes = [0];
        if (initialMode === "standard") {
          updateEditingTrainFormatFromStandard();
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editingTrainFormat) return null;

  const invalidCabIndex = editingTrainFormat.cabFormats.findIndex(cab =>
    cab && !Object.keys(uiOneHandleMasterControllerConfigs).includes(cab.oneHandleMasterControllerUIConfigId)
  );

  const isDuplicateId = isAddingTrainFormat && Object.keys(trainFormats).includes(newTrainFormatId);
  const hasNoBogies = !editingTrainFormat.bogies.length;
  const hasNoAxles = editingTrainFormat.bogies.some(bogie => !bogie.axles.length);
  const hasInvalidCab = 0 <= invalidCabIndex;

  const hasError = isDuplicateId || hasNoBogies || hasNoAxles || hasInvalidCab;

  const handleModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: "advanced" | "standard",
  ) => {
    if (!newMode) return;
    if (editingTrainFormatMode === "advanced" && newMode === "standard") {
      setOpenConfirmStandard(true);
    } else {
      formState.editingTrainFormatMode = newMode;
      if (newMode === "standard") {
          updateEditingTrainFormatFromStandard();
      }
    }
  };

  const handleConfirmStandardMode = () => {
    formState.editingTrainFormatMode = "standard";
    setOpenConfirmStandard(false);
    
    if (editingTrainFormat) {
      const { carFormats, carFormatIndexes, masterControllerUIOptionId } = convertTrainFormatToStandard(editingTrainFormat);
      formState.standardCarFormats = [...carFormats];
      formState.standardCarFormatIndexes = [...carFormatIndexes];
      if (masterControllerUIOptionId) {
        formState.standardMasterControllerUIOptionId = masterControllerUIOptionId;
      }
    }
    
    if (formState.standardCarFormats.length === 0) {
      formState.standardCarFormats = [{
        carLength: 20,
        bogies: [
          { offset: -7, axles: [{ z: -1.15, diameter: 0.86, hasMotor: true }, { z: 1.15, diameter: 0.86, hasMotor: true }], weight: 0 },
          { offset: 7, axles: [{ z: -1.15, diameter: 0.86, hasMotor: true }, { z: 1.15, diameter: 0.86, hasMotor: true }], weight: 0 }
        ],
        carWeight: 30,
        couplerJointOffset: 0.5,
        couplerJointOffset1: 0.5
      }];
      formState.standardCarFormatIndexes = [0];
    }
    
    if (!formState.standardMasterControllerUIOptionId && Object.keys(uiOneHandleMasterControllerConfigs).length > 0) {
        formState.standardMasterControllerUIOptionId = Object.keys(uiOneHandleMasterControllerConfigs)[0];
    }

    updateEditingTrainFormatFromStandard();
  };

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        resetEditingTrainState();
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>{isAddingTrainFormat
        ? `Add a train format`
        : `Edit a train format "${editingTrainFormatId}"`
      }</Typography>
    </Stack>
    {isDuplicateId && <Alert severity="error">
      IDが重複しています
    </Alert>
    }
    {editingTrainFormatMode === "advanced" && (
      <>
        {hasNoBogies && <Alert
          severity="error"
          action={
            <AddBogieButton />
          }
        >
          台車を追加してください
        </Alert>
        }
        {hasNoAxles && <Alert
          severity="error"
        >
          台車に輪軸を追加してください
        </Alert>
        }
        {hasInvalidCab && <Alert
          severity="error"
        >
          {`Otherbody ${invalidCabIndex + 1} のマスコンの形式IDが間違っています`}
        </Alert>
        }
      </>
    )}
    <TextField
      label="ID"
      value={newTrainFormatIdValue}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        trainsTabPanelState.newTrainFormatId = formState.newTrainFormatId = event.target.value
      }
    />
    <ToggleButtonGroup
      color="primary"
      value={editingTrainFormatMode}
      exclusive
      onChange={handleModeChange}
      size="small"
    >
      <ToggleButton value="standard">Standard Mode</ToggleButton>
      <ToggleButton value="advanced">Advanced Mode</ToggleButton>
    </ToggleButtonGroup>

    {editingTrainFormatMode === "standard" ? (
      <StandardModeEditor />
    ) : (
      <>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>Bogies: {editingTrainFormat.bogies.length}</Typography>
          <AddBogieButton />
          <Button variant="contained" disabled={!editingTrainFormat.bogies.length} onClick={() =>
            trainsTabPanelState.selectedCarBodyIndex = 0
          }>
            Edit
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>Otherbodies: {editingTrainFormat.otherBodyOffsets.length}</Typography>
          <AddOtherBodyButton />
          <Button variant="contained" disabled={!editingTrainFormat.otherBodyOffsets.length} onClick={() =>
            trainsTabPanelState.selectedCarBodyIndex = editingTrainFormat.bogies.length
          }>
            Edit
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>Body supporter joints: {editingTrainFormat.bodySupporterJoints.length}</Typography>
          <AddBodySupporterJointButton />
          <Button variant="contained" disabled={!editingTrainFormat.bodySupporterJoints.length} onClick={() =>
            trainsTabPanelState.selectedBodySupporterJointIndex = 0
          }>
            Edit
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>Other joints: {editingTrainFormat.otherJoints.length}</Typography>
          <AddOtherJointButton />
          <Button variant="contained" disabled={!editingTrainFormat.otherJoints.length} onClick={() =>
            trainsTabPanelState.selectedOtherJointIndex = 0
          }>
            Edit
          </Button>
        </Stack>
      </>
    )}

    <Dialog open={openConfirmStandard} onClose={() => setOpenConfirmStandard(false)}>
      <DialogTitle>Switch to Standard Mode?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Switching to Standard Mode will overwrite your current manual edits. Are you sure you want to proceed?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenConfirmStandard(false)}>Cancel</Button>
        <Button onClick={handleConfirmStandardMode} color="error" variant="contained">
          Proceed
        </Button>
      </DialogActions>
    </Dialog>
    {editingTrainFormat && <>
      <Button variant="contained" startIcon={<SaveIcon />}
        disabled={trainIsDeadEnd || hasError}
        onClick={() => saveEditingTrainFormat()}>
        Save
      </Button>
    </>}
  </Stack>;
}

function BogiesEditor() {
  const { carBodyOffset, carBodyWeight } = useSnapshot(formState, { sync: true });
  const { selectedCarBodyIndex, editingTrainFormat, selectedAxleIndex } = useSnapshot(trainsTabPanelState);

  useEffect(() => focusCamera(), []);

  useEffect(() => {
    if (selectedCarBodyIndex === -1 || !editingTrainFormat) return;
    formState.carBodyOffset = editingTrainFormat.bogies[selectedCarBodyIndex].offset.toString();
    formState.carBodyWeight = editingTrainFormat.bogies[selectedCarBodyIndex].weight.toString();
    focusCamera();
  }, [selectedCarBodyIndex, editingTrainFormat]);

  if (!editingTrainFormat) return null;

  return selectedAxleIndex === -1
    ? <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
          trainsTabPanelState.selectedCarBodyIndex = -1
        }>
          Back
        </Button>
        <Typography variant="h6" gutterBottom>Editing bogie {selectedCarBodyIndex + 1} / {editingTrainFormat.bogies.length}</Typography>
        <ButtonGroup variant="contained">
          <Button variant='contained' onClick={() =>
            trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === 0
              ? editingTrainFormat.bogies.length - 1
              : selectedCarBodyIndex - 1
          }>
            {"<"}
          </Button>
          <Button variant='contained' onClick={() =>
            trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === editingTrainFormat.bogies.length - 1
              ? 0
              : selectedCarBodyIndex + 1
          }>
            {">"}
          </Button>
        </ButtonGroup>
      </Stack>
      {/** TODO Duplicate bogie */}
      {/** TODO Delete bogie */}
      {!editingTrainFormat.bogies[selectedCarBodyIndex].axles.length && <Alert
        severity="error"
        action={
          <AddAxleButton />
        }
      >
        輪軸を追加してください
      </Alert>
      }
      <TextField
        label="Offset"
        value={carBodyOffset}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.carBodyOffset = event.target.value;
          const offset = parseFloat(event.target.value);
          if (Number.isNaN(offset) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].offset = offset;
        }}
      />
      <TextField
        label="Weight"
        value={carBodyWeight}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.carBodyWeight = event.target.value;
          const weight = parseFloat(event.target.value);
          if (Number.isNaN(weight) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].weight = Math.max(0, weight);
        }}
      />
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography>Axles: {editingTrainFormat.bogies[selectedCarBodyIndex].axles.length}</Typography>
        <AddAxleButton />
        <Button variant="contained" disabled={!editingTrainFormat.bogies[selectedCarBodyIndex].axles.length} onClick={() =>
          trainsTabPanelState.selectedAxleIndex = 0
        }>
          Edit
        </Button>
      </Stack>
    </Stack>
    : <AxlesEditor />;
}

function AxlesEditor() {
  const { axleZ, diameter, hasMotor } = useSnapshot(formState, { sync: true });
  const {
    selectedCarBodyIndex,
    selectedAxleIndex,
    editingTrainFormat,
  } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    if (selectedCarBodyIndex === -1 || selectedCarBodyIndex < 0 || !editingTrainFormat || editingTrainFormat.bogies.length <= selectedCarBodyIndex || selectedAxleIndex === -1) return;
    formState.axleZ = String(editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].z);
    formState.diameter = String(editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].diameter);
    formState.hasMotor = editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].hasMotor;
  }, [selectedAxleIndex]);

  if (!editingTrainFormat) return null;

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
        trainsTabPanelState.selectedAxleIndex = -1
      }>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing axle {selectedAxleIndex + 1} / {editingTrainFormat.bogies[selectedCarBodyIndex].axles.length} in bogie {selectedCarBodyIndex + 1}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedAxleIndex = selectedAxleIndex === 0
            ? editingTrainFormat.bogies[selectedCarBodyIndex].axles.length - 1
            : selectedAxleIndex - 1
        }>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedAxleIndex = selectedAxleIndex === editingTrainFormat.bogies[selectedCarBodyIndex].axles.length - 1
            ? 0
            : selectedAxleIndex + 1
        }>
          {">"}
        </Button>
      </ButtonGroup>
    </Stack>
    {/** TODO Duplicate axle */}
    {/** TODO Delete axle */}
    <TextField
      label="Z"
      value={axleZ}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.axleZ = event.target.value;
        const z = parseFloat(event.target.value);
        if (Number.isNaN(z) || !trainsTabPanelState.editingTrainFormat) return;

        trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].z = z;
      }}
    />
    <TextField
      label="Diameter"
      value={diameter}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.diameter = event.target.value;
        const diameter = parseFloat(event.target.value);
        if (Number.isNaN(diameter) || !trainsTabPanelState.editingTrainFormat) return;

        trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].diameter = Math.max(0.1, diameter);
      }}
    />
    <FormControlLabel control={<Checkbox size="small" checked={hasMotor} onChange={event => {
      if (!trainsTabPanelState.editingTrainFormat) return;
      trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].hasMotor =
        formState.hasMotor = event.target.checked;
    }} />} label="has motor" />
  </Stack>;
}

function OtherBodiesEditor() {
  const { uiOneHandleMasterControllerConfigs } = useSnapshot(store.data);
  const { carBodyOffset, carBodyWeight, hasCab, directionIsReversed, oneHandleMasterControllerUIConfigId } = useSnapshot(formState, { sync: true });
  const { selectedCarBodyIndex, editingTrainFormat, isShowOneHandleMasterControllerConfig } = useSnapshot(trainsTabPanelState);

  useEffect(() => focusCamera(), []);

  useEffect(() => {
    if (selectedCarBodyIndex === -1 || !editingTrainFormat) return;
    formState.carBodyOffset = editingTrainFormat.otherBodyOffsets[selectedCarBodyIndex - editingTrainFormat.bogies.length].toString();
    formState.carBodyWeight = editingTrainFormat.otherBodyWeights[selectedCarBodyIndex - editingTrainFormat.bogies.length].toString();
    focusCamera();
  }, [selectedCarBodyIndex]);

  useEffect(() => {
    if (!trainsTabPanelState.editingTrainFormat || !editingTrainFormat) return;
    trainsTabPanelState.editingTrainFormat.cabFormats[selectedCarBodyIndex - editingTrainFormat.bogies.length] =
      hasCab && oneHandleMasterControllerUIConfigId
        ? {
          directionIsReversed,
          oneHandleMasterControllerUIConfigId,
        }
        : null;
  }, [hasCab, directionIsReversed, editingTrainFormat]);

  if (!editingTrainFormat) return null;

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        trainsTabPanelState.selectedCarBodyIndex = -1;
        trainsTabPanelState.isSelectingCarBodyA = false;
        trainsTabPanelState.isSelectingCarBodyB = false;
        trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint = false;
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing otherbody {selectedCarBodyIndex + 1 - editingTrainFormat.bogies.length} / {editingTrainFormat.otherBodyOffsets.length}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === editingTrainFormat.bogies.length
            ? editingTrainFormat.bogies.length + editingTrainFormat.otherBodyOffsets.length - 1
            : selectedCarBodyIndex - 1
        }>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === editingTrainFormat.bogies.length + editingTrainFormat.otherBodyOffsets.length - 1
            ? editingTrainFormat.bogies.length
            : selectedCarBodyIndex + 1
        }>
          {">"}
        </Button>
      </ButtonGroup>
    </Stack>
    {/** TODO Duplicate otherBody */}
    {/** TODO Delete otherBody */}
    <TextField
      label="Offset"
      value={carBodyOffset}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.carBodyOffset = event.target.value;
        const offset = parseFloat(event.target.value);
        if (Number.isNaN(offset) || !trainsTabPanelState.editingTrainFormat) return;

        trainsTabPanelState.editingTrainFormat.otherBodyOffsets[selectedCarBodyIndex - editingTrainFormat.bogies.length] = offset;
      }}
    />
    <TextField
      label="Weight"
      value={carBodyWeight}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.carBodyWeight = event.target.value;
        const weight = parseFloat(event.target.value);
        if (Number.isNaN(weight) || !trainsTabPanelState.editingTrainFormat) return;

        trainsTabPanelState.editingTrainFormat.otherBodyWeights[selectedCarBodyIndex - editingTrainFormat.bogies.length] = Math.max(0, weight);
      }}
    />
    <Typography variant="h6">Control stand</Typography>
    {hasCab && !Object.keys(uiOneHandleMasterControllerConfigs).includes(oneHandleMasterControllerUIConfigId) && <Alert
      severity="error"
    >
      マスコンの形式IDが間違っています
    </Alert>
    }
    <FormControlLabel control={<Checkbox size="small" checked={hasCab} onChange={event => {
      formState.hasCab = event.target.checked;
    }} />} label="has control stand" />
    <FormControlLabel control={<Checkbox size="small" disabled={!hasCab} checked={directionIsReversed} onChange={event => {
      formState.directionIsReversed = event.target.checked;
    }} />} label="Direction is reversed" />
    <Stack direction="row" spacing={1} alignItems="center">
      <FormControl fullWidth>
        <InputLabel id="master-controller-type-id-select-label">Master controller type ID</InputLabel>
        <Select
          labelId="master-controller-type-id-select-label"
          disabled={!hasCab}
          value={oneHandleMasterControllerUIConfigId}
          label="Master controller type ID"
          onChange={event => formState.oneHandleMasterControllerUIConfigId = event.target.value}
          error={!Object.keys(uiOneHandleMasterControllerConfigs).includes(oneHandleMasterControllerUIConfigId)}
        >
          {Object.keys(uiOneHandleMasterControllerConfigs).map(id =>
            <MenuItem key={id} value={id}>{id}</MenuItem>
          )}
        </Select>
      </FormControl>
      <IconButton color="primary" onClick={() => trainsTabPanelState.isShowOneHandleMasterControllerConfig = true}>
        <TuneIcon />
      </IconButton>
      <Drawer anchor="right" open={isShowOneHandleMasterControllerConfig} onClose={() => trainsTabPanelState.isShowOneHandleMasterControllerConfig = false}>
        <Stack sx={{ width: 480 }}>
          <UIOneHandleMasterControllerConfigTable />
        </Stack>
      </Drawer>
    </Stack>
  </Stack>;
}

function BodySupporterJointsEditor() {
  const { jointAPositionX, jointAPositionY, jointAPositionZ, jointBPositionX, jointBPositionY, jointBPositionZ } = useSnapshot(formState, { sync: true });
  const { selectedBodySupporterJointIndex, editingTrainFormat, isSelectingCarBodyA, isSelectingCarBodyB } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    if (selectedBodySupporterJointIndex === -1 || !editingTrainFormat) return;
    formState.jointAPositionX = editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.x.toString();
    formState.jointAPositionY = editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.y.toString();
    formState.jointAPositionZ = editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.z.toString();
    formState.jointBPositionX = editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.x.toString();
    formState.jointBPositionY = editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.y.toString();
    formState.jointBPositionZ = editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.z.toString();
  }, [selectedBodySupporterJointIndex, editingTrainFormat]);

  if (!editingTrainFormat) return null;

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        trainsTabPanelState.selectedBodySupporterJointIndex = -1;
        trainsTabPanelState.isSelectingCarBodyA = false;
        trainsTabPanelState.isSelectingCarBodyB = false;
        trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint = false;
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing body supporter joint {selectedBodySupporterJointIndex + 1} / {editingTrainFormat.bodySupporterJoints.length}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedBodySupporterJointIndex = selectedBodySupporterJointIndex === 0
            ? editingTrainFormat.bodySupporterJoints.length - 1
            : selectedBodySupporterJointIndex - 1;
        }}>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedBodySupporterJointIndex = selectedBodySupporterJointIndex === editingTrainFormat.bodySupporterJoints.length - 1
            ? 0
            : selectedBodySupporterJointIndex + 1;
        }}>
          {">"}
        </Button>
      </ButtonGroup>
    </Stack>
    {/** TODO Delete otherBody */}
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="h6" gutterBottom>Otherbody: {
        editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyIndex === -1
          ? "Not selected"
          : editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyIndex + 1
      }</Typography>
      <ToggleButton
        size="small"
        value="check"
        selected={isSelectingCarBodyA}
        onChange={() => {
          trainsTabPanelState.isSelectingCarBodyB = false;
          trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint
            = trainsTabPanelState.isSelectingCarBodyA
            = !trainsTabPanelState.isSelectingCarBodyA;
        }}
      >
        Select
      </ToggleButton>
      <TextField
        label="X"
        value={jointAPositionX}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionX = event.target.value;
          const x = parseFloat(event.target.value);
          if (Number.isNaN(x) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.x = x;
          updateEditingTrainFormat();
        }}
      />
      <TextField
        label="Y"
        value={jointAPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.y = y;
          updateEditingTrainFormat();
        }}
      />
      <TextField
        label="Z"
        value={jointAPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.z = z;
          updateEditingTrainFormat();
        }}
      />
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="h6" gutterBottom>Bogie: {
        editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogieIndex === -1
          ? "Not selected"
          : editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogieIndex + 1
      }</Typography>
      <ToggleButton
        size="small"
        value="check"
        selected={isSelectingCarBodyB}
        onChange={() => {
          trainsTabPanelState.isSelectingCarBodyA = false;
          trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint
            = trainsTabPanelState.isSelectingCarBodyB
            = !trainsTabPanelState.isSelectingCarBodyB;
        }}
      >
        Select
      </ToggleButton>
      <TextField
        label="X"
        value={jointBPositionX}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionX = event.target.value;
          const x = parseFloat(event.target.value);
          if (Number.isNaN(x) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.x = x;
          updateEditingTrainFormat();

        }}
      />
      <TextField
        label="Y"
        value={jointBPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.y = y;
          updateEditingTrainFormat();
        }}
      />
      <TextField
        label="Z"
        value={jointBPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.z = z;
          updateEditingTrainFormat();
        }}
      />
    </Stack>
  </Stack>;
}

function OtherJointsEditor() {
  const { jointAPositionX, jointAPositionY, jointAPositionZ, jointBPositionX, jointBPositionY, jointBPositionZ } = useSnapshot(formState, { sync: true });
  const { editingTrainFormat, selectedOtherJointIndex, isSelectingCarBodyA, isSelectingCarBodyB } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    if (selectedOtherJointIndex === -1 || !editingTrainFormat) return;
    formState.jointAPositionX = editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.x.toString();
    formState.jointAPositionY = editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.y.toString();
    formState.jointAPositionZ = editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.z.toString();
    formState.jointBPositionX = editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.x.toString();
    formState.jointBPositionY = editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.y.toString();
    formState.jointBPositionZ = editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.z.toString();
  }, [selectedOtherJointIndex]);

  if (!editingTrainFormat) return null;

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        trainsTabPanelState.selectedOtherJointIndex = -1;
        trainsTabPanelState.isSelectingCarBodyA = false;
        trainsTabPanelState.isSelectingCarBodyB = false;
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing other joint {selectedOtherJointIndex + 1} / {editingTrainFormat.otherJoints.length}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedOtherJointIndex = selectedOtherJointIndex === 0
            ? editingTrainFormat.otherJoints.length - 1
            : selectedOtherJointIndex - 1;
        }}>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedOtherJointIndex = selectedOtherJointIndex === editingTrainFormat.otherJoints.length - 1
            ? 0
            : selectedOtherJointIndex + 1;
        }}>
          {">"}
        </Button>
      </ButtonGroup>
    </Stack>
    {/** TODO Delete otherBody */}
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="h6" gutterBottom>Carbody A: {
        editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexA === -1
          ? "Not selected"
          : editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexA < editingTrainFormat.bogies.length
            ? `Bogie ${editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexA + 1}`
            : `Otherbody ${editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexA + 1 - editingTrainFormat.bogies.length}`
      }</Typography>
      <ToggleButton
        size="small"
        value="check"
        selected={isSelectingCarBodyA}
        onChange={() => {
          trainsTabPanelState.isSelectingCarBodyB = false;
          trainsTabPanelState.isSelectingCarBodyA = !trainsTabPanelState.isSelectingCarBodyA;
        }}
      >
        Select
      </ToggleButton>
      <TextField
        label="X"
        value={jointAPositionX}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionX = event.target.value;
          const x = parseFloat(event.target.value);
          if (Number.isNaN(x) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.x = x;
          updateEditingTrainFormat();
        }}
      />
      <TextField
        label="Y"
        value={jointAPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.y = y;
          updateEditingTrainFormat();
        }}
      />
      <TextField
        label="Z"
        value={jointAPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.z = z;
          updateEditingTrainFormat();
        }}
      />
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="h6" gutterBottom>Carbody B: {
        editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexB === -1
          ? "Not selected"
          : editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexB < editingTrainFormat.bogies.length
            ? `Bogie ${editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexB + 1}`
            : `Otherbody ${editingTrainFormat.otherJoints[selectedOtherJointIndex].bodyIndexB + 1 - editingTrainFormat.bogies.length}`
      }</Typography>
      <ToggleButton
        size="small"
        value="check"
        selected={isSelectingCarBodyB}
        onChange={() => {
          trainsTabPanelState.isSelectingCarBodyA = false;
          trainsTabPanelState.isSelectingCarBodyB = !trainsTabPanelState.isSelectingCarBodyB;
        }}
      >
        Select
      </ToggleButton>
      <TextField
        label="X"
        value={jointBPositionX}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionX = event.target.value;
          const x = parseFloat(event.target.value);
          if (Number.isNaN(x) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.x = x;
          updateEditingTrainFormat();

        }}
      />
      <TextField
        label="Y"
        value={jointBPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.y = y;
          updateEditingTrainFormat();
        }}
      />
      <TextField
        label="Z"
        value={jointBPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z) || !trainsTabPanelState.editingTrainFormat) return;

          trainsTabPanelState.editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.z = z;
          updateEditingTrainFormat();
        }}
      />
    </Stack>
  </Stack>;
}
