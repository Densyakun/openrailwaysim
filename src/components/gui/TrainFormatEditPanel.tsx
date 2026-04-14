// TODO
import * as THREE from "three";
import { proxy, useSnapshot } from "valtio";
import { Alert, Button, ButtonGroup, Checkbox, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Paper, Select, Stack, TextField, ToggleButton, Typography } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import TuneIcon from '@mui/icons-material/Tune';
import { placeTrain, SerializableTrain } from "@/lib/trains";
import { resetEditingTrainState, trainsTabPanelState } from "@/lib/client/trains";
import { useEffect } from "react";
import { getPosition } from "@/lib/tracks";
import UIOneHandleMasterControllerConfigTable from "./UIOneHandleMasterControllerConfigTable";
import { store, serialize, trainTypeId } from "@/lib/game";
import { v4 as uuidv4 } from 'uuid';
import { socket } from "../Client";
import { setCameraTargetPosition } from "@/lib/client/camera";
import { MessageCode, send } from "@/lib/ws";

const formState = proxy<{
  newTrainId: string;
  carBodyOffset: string;
  carBodyWeight: string;
  axleZ: string;
  diameter: string;
  hasMotor: boolean;
  controlStand: boolean;
  directionIsReversed: boolean;
  reverser: number;
  masterController: OneHandleMasterController;
  jointAPositionX: string;
  jointAPositionY: string;
  jointAPositionZ: string;
  jointBPositionX: string;
  jointBPositionY: string;
  jointBPositionZ: string;
}>({
  newTrainId: "",
  carBodyOffset: "",
  carBodyWeight: "",
  axleZ: String(0),
  diameter: String(0.86),
  hasMotor: true,
  controlStand: false,
  directionIsReversed: false,
  reverser: 0,
  masterController: {
    value: 0,
    uiOptionId: "",
  },
  jointAPositionX: "",
  jointAPositionY: "",
  jointAPositionZ: "",
  jointBPositionX: "",
  jointBPositionY: "",
  jointBPositionZ: "",
});

function focusCamera() {
  if (!Object.keys(store.data.tracks).length) return;
  if (!trainsTabPanelState.editingTrain) return;

  if (0 <= trainsTabPanelState.selectedCarBodyIndex) {
    // To carbody
    const selectedBody = trainsTabPanelState.selectedCarBodyIndex < trainsTabPanelState.axleTable.length
      ? trainsTabPanelState.editingTrain.bogies[trainsTabPanelState.selectedCarBodyIndex]
      : trainsTabPanelState.editingTrain.otherBodies[trainsTabPanelState.selectedCarBodyIndex - trainsTabPanelState.axleTable.length];
    setCameraTargetPosition(selectedBody.position);
  } else if (trainsTabPanelState.pointOnTrack) {
    // To train
    const track = store.data.tracks[trainsTabPanelState.pointOnTrack.trackId];
    const position = getPosition(track, trainsTabPanelState.pointOnTrack.length);
    setCameraTargetPosition(position);
  }
}

function updateEditingTrain() {
  const {
    pointOnTrack,
    directionIsReversed,
    editingTrainFormat,
  } = trainsTabPanelState;

  if (!Object.keys(store.data.tracks).length) return;
  if (!editingTrainFormat || !pointOnTrack) return;

  const { train, isDeadEnd } = placeTrain(
    editingTrainFormat,
    pointOnTrack,
    directionIsReversed,
  );

  trainsTabPanelState.trainIsDeadEnd = isDeadEnd;

  return trainsTabPanelState.editingTrain = train;
}

function saveEditingTrain() {
  if (trainsTabPanelState.editingTrainFormatId) {
    // TODO
    return;
  }

  // Add new train
  if (Object.keys(store.data.trains).includes(trainsTabPanelState.newTrainId))
    return;

  const trainId = trainsTabPanelState.newTrainId || uuidv4();
  const train: SerializableTrain = serialize(trainTypeId, updateEditingTrain());

  const trainGroup = [...store.data.trainGroups[trainsTabPanelState.selectedTrainGroup]];
  trainGroup.push(trainId);

  send(socket, MessageCode.FROM_CLIENT_MESSAGES, [
    [MessageCode.FROM_CLIENT_SET_PROP, [["trains", trainId], train]],
    [MessageCode.FROM_CLIENT_SET_PROP, [["trainGroups", trainsTabPanelState.selectedTrainGroup], trainGroup]],
  ]);

  trainsTabPanelState.isAddingTrainFormat = false;
  resetEditingTrainState();
}

export default function TrainFormatEditPanel() {
  const {
    selectedTrainGroup,
    editingTrain,
    selectedCarBodyIndex,
    selectedBodySupporterJointIndex,
    selectedOtherJointIndex,
    pointOnTrack,
    bogieOffsets,
    bogieWeights,
    axleTable,
    otherBodyOffsets,
    otherBodyWeights,
    controlStands,
    bodySupporterJoints,
    otherJoints,
    directionIsReversed,
    trainIsDeadEnd,
  } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    updateEditingTrain();
  }, [
    pointOnTrack,
    bogieOffsets,
    bogieWeights,
    axleTable,
    otherBodyOffsets,
    otherBodyWeights,
    controlStands,
    bodySupporterJoints,
    otherJoints,
    directionIsReversed,
  ]);

  useEffect(() => {
    focusCamera();
  }, [editingTrain]);

  if (!selectedTrainGroup) return null;

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    {selectedCarBodyIndex !== -1
      ? selectedCarBodyIndex < axleTable.length
        ? <BogiesEditor />
        : <OtherBodiesEditor />
      : selectedBodySupporterJointIndex !== -1
        ? <BodySupporterJointsEditor />
        : selectedOtherJointIndex !== -1
          ? <OtherJointsEditor />
          : <TrainEditor trainIsDeadEnd={trainIsDeadEnd} />}
  </Paper>;
}

function AddBogieButton() {
  return <Button variant="contained" onClick={() => {
    trainsTabPanelState.bogieOffsets.push(0);
    trainsTabPanelState.bogieWeights.push(0);
    trainsTabPanelState.axleTable.push([{
      z: 0,
      diameter: 0.86,
      hasMotor: true,
    }]);
  }}>
    Add bogie
  </Button>;
}

function AddAxleButton() {
  return <Button variant="contained" onClick={() => {
    trainsTabPanelState.axleTable[trainsTabPanelState.selectedCarBodyIndex].push({
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
    trainsTabPanelState.otherBodyOffsets.push(0);
    trainsTabPanelState.otherBodyWeights.push(0);
    trainsTabPanelState.controlStands.push(null);
  }}>
    Add otherbody
  </Button>;
}

function AddBodySupporterJointButton() {
  return <Button variant="contained" onClick={() =>
    trainsTabPanelState.bodySupporterJoints.push({
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
    trainsTabPanelState.otherJoints.push({
      bodyIndexA: -1,
      positionA: new THREE.Vector3(),
      bodyIndexB: -1,
      positionB: new THREE.Vector3(),
    })
  }>
    Add other joint
  </Button>;
}

function TrainEditor({ trainIsDeadEnd }: { trainIsDeadEnd: boolean }) {
  const {
    isAddingTrainFormat,
    selectedTrainGroup,
    editingTrainFormatId,
    newTrainId,
    pointOnTrack,
    axleTable,
    otherBodyOffsets,
    controlStands,
    bodySupporterJoints,
    otherJoints,
    directionIsReversed,
    editingTrain,
  } = trainsTabPanelState;

  const { newTrainId: newTrainId_ } = useSnapshot(formState, { sync: true });
  const { trains, uiOneHandleMasterControllerConfigs } = useSnapshot(store.data);

  useEffect(() => {
    focusCamera();
    formState.newTrainId = newTrainId;
  }, []);

  const invalidControlStandIndex = controlStands.findIndex(controlStand =>
    controlStand && !Object.keys(uiOneHandleMasterControllerConfigs).includes(controlStand.masterController.uiOptionId)
  );

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        trainsTabPanelState.isAddingTrainFormat = false;
        trainsTabPanelState.editingTrainFormatId = "";
        trainsTabPanelState.editingTrain = undefined;
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>{isAddingTrainFormat
        ? `Add a train to ${selectedTrainGroup}`
        : `Edit a train "${editingTrainFormatId}"`
      }</Typography>
    </Stack>
    {isAddingTrainFormat && Object.keys(trains).includes(trainsTabPanelState.newTrainId) && <Alert severity="error">
      IDが重複しています
    </Alert>
    }
    {!pointOnTrack && <Alert severity="error">
      列車を設置する位置を選択してください
    </Alert>
    }
    {!axleTable.length && <Alert
      severity="error"
      action={
        <AddBogieButton />
      }
    >
      台車を追加してください
    </Alert>
    }
    {trainIsDeadEnd && <Alert severity="error">
      列車が軌道の外に出ています
    </Alert>
    }
    {0 <= invalidControlStandIndex && <Alert
      severity="error"
    >
      {`Otherbody ${invalidControlStandIndex + 1} のマスコンの形式IDが間違っています`}
    </Alert>
    }
    <TextField
      label="ID"
      value={newTrainId_}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        trainsTabPanelState.newTrainId = formState.newTrainId = event.target.value
      }
    />
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography>Bogies: {axleTable.length}</Typography>
      <AddBogieButton />
      <Button variant="contained" disabled={!axleTable.length} onClick={() =>
        trainsTabPanelState.selectedCarBodyIndex = 0
      }>
        Edit
      </Button>
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography>Otherbodies: {otherBodyOffsets.length}</Typography>
      <AddOtherBodyButton />
      <Button variant="contained" disabled={!otherBodyOffsets.length} onClick={() =>
        trainsTabPanelState.selectedCarBodyIndex = axleTable.length
      }>
        Edit
      </Button>
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography>Body supporter joints: {bodySupporterJoints.length}</Typography>
      <AddBodySupporterJointButton />
      <Button variant="contained" disabled={!bodySupporterJoints.length} onClick={() =>
        trainsTabPanelState.selectedBodySupporterJointIndex = 0
      }>
        Edit
      </Button>
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography>Other joints: {otherJoints.length}</Typography>
      <AddOtherJointButton />
      <Button variant="contained" disabled={!otherJoints.length} onClick={() =>
        trainsTabPanelState.selectedOtherJointIndex = 0
      }>
        Edit
      </Button>
    </Stack>
    <Button variant="contained" startIcon={<ScreenRotationIcon />} onClick={() =>
      trainsTabPanelState.directionIsReversed = !directionIsReversed
    }>
      Reverse direction
    </Button>
    {editingTrain && <>
      <Typography variant="h6" gutterBottom>Train weight: {editingTrain.weight}</Typography>
      <Button variant="contained" startIcon={<SaveIcon />}
        disabled={trainIsDeadEnd}
        onClick={() => saveEditingTrain()}>
        Save
      </Button>
    </>}
  </Stack>;
}

function BogiesEditor() {
  const { carBodyOffset, carBodyWeight } = useSnapshot(formState, { sync: true });
  const { selectedCarBodyIndex, bogieOffsets, bogieWeights, axleTable, selectedAxleIndex } = useSnapshot(trainsTabPanelState);

  useEffect(() => focusCamera(), []);

  useEffect(() => {
    if (selectedCarBodyIndex === -1) return;
    formState.carBodyOffset = bogieOffsets[selectedCarBodyIndex].toString();
    formState.carBodyWeight = bogieWeights[selectedCarBodyIndex].toString();
    focusCamera();
  }, [selectedCarBodyIndex]);

  return selectedAxleIndex === -1
    ? <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
          trainsTabPanelState.selectedCarBodyIndex = -1
        }>
          Back
        </Button>
        <Typography variant="h6" gutterBottom>Editing bogie {selectedCarBodyIndex + 1} / {axleTable.length}</Typography>
        <ButtonGroup variant="contained">
          <Button variant='contained' onClick={() =>
            trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === 0
              ? axleTable.length - 1
              : selectedCarBodyIndex - 1
          }>
            {"<"}
          </Button>
          <Button variant='contained' onClick={() =>
            trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === axleTable.length - 1
              ? 0
              : selectedCarBodyIndex + 1
          }>
            {">"}
          </Button>
        </ButtonGroup>
      </Stack>
      {/** TODO Duplicate bogie */}
      {/** TODO Delete bogie */}
      {!axleTable[selectedCarBodyIndex].length && <Alert
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
          if (Number.isNaN(offset)) return;

          trainsTabPanelState.bogieOffsets[selectedCarBodyIndex] = offset;
        }}
      />
      <TextField
        label="Weight"
        value={carBodyWeight}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.carBodyWeight = event.target.value;
          const weight = parseFloat(event.target.value);
          if (Number.isNaN(weight)) return;

          trainsTabPanelState.bogieWeights[selectedCarBodyIndex] = Math.max(0, weight);
        }}
      />
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography>Axles: {axleTable[selectedCarBodyIndex].length}</Typography>
        <AddAxleButton />
        <Button variant="contained" disabled={!axleTable[selectedCarBodyIndex].length} onClick={() =>
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
    axleTable,
  } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    if (selectedCarBodyIndex === -1 || selectedCarBodyIndex < 0 || axleTable.length <= selectedCarBodyIndex || selectedAxleIndex === -1) return;
    formState.axleZ = String(axleTable[selectedCarBodyIndex][selectedAxleIndex].z);
    formState.diameter = String(axleTable[selectedCarBodyIndex][selectedAxleIndex].diameter);
    formState.hasMotor = axleTable[selectedCarBodyIndex][selectedAxleIndex].hasMotor;
  }, [selectedAxleIndex]);

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() =>
        trainsTabPanelState.selectedAxleIndex = -1
      }>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing axle {selectedAxleIndex + 1} / {axleTable[selectedCarBodyIndex].length} in bogie {selectedCarBodyIndex + 1}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedAxleIndex = selectedAxleIndex === 0
            ? axleTable[selectedCarBodyIndex].length - 1
            : selectedAxleIndex - 1
        }>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedAxleIndex = selectedAxleIndex === axleTable[selectedCarBodyIndex].length - 1
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
        if (Number.isNaN(z)) return;

        trainsTabPanelState.axleTable[selectedCarBodyIndex][selectedAxleIndex].z = z;
      }}
    />
    <TextField
      label="Diameter"
      value={diameter}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.diameter = event.target.value;
        const diameter = parseFloat(event.target.value);
        if (Number.isNaN(diameter)) return;

        trainsTabPanelState.axleTable[selectedCarBodyIndex][selectedAxleIndex].diameter = Math.max(0.1, diameter);
      }}
    />
    <FormControlLabel control={<Checkbox size="small" checked={hasMotor} onChange={event => {
      trainsTabPanelState.axleTable[selectedCarBodyIndex][selectedAxleIndex].hasMotor =
        formState.hasMotor = event.target.checked;
    }} />} label="has motor" />
  </Stack>;
}

function OtherBodiesEditor() {
  const { uiOneHandleMasterControllerConfigs } = useSnapshot(store.data);
  const { carBodyOffset, carBodyWeight, controlStand, directionIsReversed, reverser, masterController } = useSnapshot(formState, { sync: true });
  const { selectedCarBodyIndex, axleTable, otherBodyOffsets, otherBodyWeights, isShowOneHandleMasterControllerConfig } = useSnapshot(trainsTabPanelState);

  useEffect(() => focusCamera(), []);

  useEffect(() => {
    if (selectedCarBodyIndex === -1) return;
    formState.carBodyOffset = otherBodyOffsets[selectedCarBodyIndex - axleTable.length].toString();
    formState.carBodyWeight = otherBodyWeights[selectedCarBodyIndex - axleTable.length].toString();
    focusCamera();
  }, [selectedCarBodyIndex]);

  useEffect(() => {
    trainsTabPanelState.controlStands[selectedCarBodyIndex - axleTable.length] =
      controlStand && masterController.uiOptionId
        ? {
          directionIsReversed,
          reverser,
          masterController,
        }
        : null;
  }, [controlStand, directionIsReversed, reverser, masterController]);

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
      <Typography variant="h6" gutterBottom>Editing otherbody {selectedCarBodyIndex + 1 - axleTable.length} / {otherBodyOffsets.length}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === axleTable.length
            ? axleTable.length + otherBodyOffsets.length - 1
            : selectedCarBodyIndex - 1
        }>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() =>
          trainsTabPanelState.selectedCarBodyIndex = selectedCarBodyIndex === axleTable.length + otherBodyOffsets.length - 1
            ? axleTable.length
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
        if (Number.isNaN(offset)) return;

        trainsTabPanelState.otherBodyOffsets[selectedCarBodyIndex - axleTable.length] = offset;
      }}
    />
    <TextField
      label="Weight"
      value={carBodyWeight}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.carBodyWeight = event.target.value;
        const weight = parseFloat(event.target.value);
        if (Number.isNaN(weight)) return;

        trainsTabPanelState.otherBodyWeights[selectedCarBodyIndex - axleTable.length] = Math.max(0, weight);
      }}
    />
    <Typography variant="h6">Control stand</Typography>
    {controlStand && !Object.keys(uiOneHandleMasterControllerConfigs).includes(masterController.uiOptionId) && <Alert
      severity="error"
    >
      マスコンの形式IDが間違っています
    </Alert>
    }
    <FormControlLabel control={<Checkbox size="small" checked={controlStand} onChange={event => {
      formState.controlStand = event.target.checked;
    }} />} label="has control stand" />
    <FormControlLabel control={<Checkbox size="small" disabled={!controlStand} checked={directionIsReversed} onChange={event => {
      formState.directionIsReversed = event.target.checked;
    }} />} label="Direction is reversed" />
    <Stack direction="row" spacing={1} alignItems="center">
      <FormControl fullWidth>
        <InputLabel id="master-controller-type-id-select-label">Master controller type ID</InputLabel>
        <Select
          labelId="master-controller-type-id-select-label"
          disabled={!controlStand}
          value={masterController.uiOptionId}
          label="Master controller type ID"
          onChange={event => formState.masterController.uiOptionId = event.target.value}
          error={!Object.keys(uiOneHandleMasterControllerConfigs).includes(masterController.uiOptionId)}
        >
          {Object.keys(uiOneHandleMasterControllerConfigs).map(id =>
            <MenuItem key={id} value={id}>{id}</MenuItem>
          )}
        </Select>
      </FormControl>
      <IconButton color="primary" onClick={() => trainsTabPanelState.isShowOneHandleMasterControllerConfig = true}>
        <TuneIcon />
      </IconButton>
      <Drawer open={isShowOneHandleMasterControllerConfig} onClose={() => trainsTabPanelState.isShowOneHandleMasterControllerConfig = false}>
        <Stack sx={{ width: 480 }}>
          <UIOneHandleMasterControllerConfigTable />
        </Stack>
      </Drawer>
    </Stack>
  </Stack>;
}

function BodySupporterJointsEditor() {
  const { jointAPositionX, jointAPositionY, jointAPositionZ, jointBPositionX, jointBPositionY, jointBPositionZ } = useSnapshot(formState, { sync: true });
  const { selectedBodySupporterJointIndex, bodySupporterJoints, isSelectingCarBodyA, isSelectingCarBodyB } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    if (selectedBodySupporterJointIndex === -1) return;
    formState.jointAPositionX = bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.x.toString();
    formState.jointAPositionY = bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.y.toString();
    formState.jointAPositionZ = bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.z.toString();
    formState.jointBPositionX = bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.x.toString();
    formState.jointBPositionY = bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.y.toString();
    formState.jointBPositionZ = bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.z.toString();
  }, [selectedBodySupporterJointIndex]);

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
      <Typography variant="h6" gutterBottom>Editing body supporter joint {selectedBodySupporterJointIndex + 1} / {bodySupporterJoints.length}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedBodySupporterJointIndex = selectedBodySupporterJointIndex === 0
            ? bodySupporterJoints.length - 1
            : selectedBodySupporterJointIndex - 1;
        }}>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedBodySupporterJointIndex = selectedBodySupporterJointIndex === bodySupporterJoints.length - 1
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
        bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyIndex === -1
          ? "Not selected"
          : bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyIndex + 1
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
          if (Number.isNaN(x)) return;

          trainsTabPanelState.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.x = x;
          updateEditingTrain();
        }}
      />
      <TextField
        label="Y"
        value={jointAPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y)) return;

          trainsTabPanelState.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.y = y;
          updateEditingTrain();
        }}
      />
      <TextField
        label="Z"
        value={jointAPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z)) return;

          trainsTabPanelState.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.z = z;
          updateEditingTrain();
        }}
      />
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="h6" gutterBottom>Bogie: {
        bodySupporterJoints[selectedBodySupporterJointIndex].bogieIndex === -1
          ? "Not selected"
          : bodySupporterJoints[selectedBodySupporterJointIndex].bogieIndex + 1
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
          if (Number.isNaN(x)) return;

          trainsTabPanelState.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.x = x;
          updateEditingTrain();

        }}
      />
      <TextField
        label="Y"
        value={jointBPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y)) return;

          trainsTabPanelState.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.y = y;
          updateEditingTrain();
        }}
      />
      <TextField
        label="Z"
        value={jointBPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z)) return;

          trainsTabPanelState.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.z = z;
          updateEditingTrain();
        }}
      />
    </Stack>
  </Stack>;
}

function OtherJointsEditor() {
  const { jointAPositionX, jointAPositionY, jointAPositionZ, jointBPositionX, jointBPositionY, jointBPositionZ } = useSnapshot(formState, { sync: true });
  const { axleTable, selectedOtherJointIndex, otherJoints, isSelectingCarBodyA, isSelectingCarBodyB } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    if (selectedOtherJointIndex === -1) return;
    formState.jointAPositionX = otherJoints[selectedOtherJointIndex].positionA.x.toString();
    formState.jointAPositionY = otherJoints[selectedOtherJointIndex].positionA.y.toString();
    formState.jointAPositionZ = otherJoints[selectedOtherJointIndex].positionA.z.toString();
    formState.jointBPositionX = otherJoints[selectedOtherJointIndex].positionB.x.toString();
    formState.jointBPositionY = otherJoints[selectedOtherJointIndex].positionB.y.toString();
    formState.jointBPositionZ = otherJoints[selectedOtherJointIndex].positionB.z.toString();
  }, [selectedOtherJointIndex]);

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        trainsTabPanelState.selectedOtherJointIndex = -1;
        trainsTabPanelState.isSelectingCarBodyA = false;
        trainsTabPanelState.isSelectingCarBodyB = false;
      }}>
        Back
      </Button>
      <Typography variant="h6" gutterBottom>Editing other joint {selectedOtherJointIndex + 1} / {otherJoints.length}</Typography>
      <ButtonGroup variant="contained">
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedOtherJointIndex = selectedOtherJointIndex === 0
            ? otherJoints.length - 1
            : selectedOtherJointIndex - 1;
        }}>
          {"<"}
        </Button>
        <Button variant='contained' onClick={() => {
          trainsTabPanelState.selectedOtherJointIndex = selectedOtherJointIndex === otherJoints.length - 1
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
        otherJoints[selectedOtherJointIndex].bodyIndexA === -1
          ? "Not selected"
          : otherJoints[selectedOtherJointIndex].bodyIndexA < axleTable.length
            ? `Bogie ${otherJoints[selectedOtherJointIndex].bodyIndexA + 1}`
            : `Otherbody ${otherJoints[selectedOtherJointIndex].bodyIndexA + 1 - axleTable.length}`
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
          if (Number.isNaN(x)) return;

          trainsTabPanelState.otherJoints[selectedOtherJointIndex].positionA.x = x;
          updateEditingTrain();
        }}
      />
      <TextField
        label="Y"
        value={jointAPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y)) return;

          trainsTabPanelState.otherJoints[selectedOtherJointIndex].positionA.y = y;
          updateEditingTrain();
        }}
      />
      <TextField
        label="Z"
        value={jointAPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointAPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z)) return;

          trainsTabPanelState.otherJoints[selectedOtherJointIndex].positionA.z = z;
          updateEditingTrain();
        }}
      />
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="h6" gutterBottom>Carbody B: {
        otherJoints[selectedOtherJointIndex].bodyIndexB === -1
          ? "Not selected"
          : otherJoints[selectedOtherJointIndex].bodyIndexB < axleTable.length
            ? `Bogie ${otherJoints[selectedOtherJointIndex].bodyIndexB + 1}`
            : `Otherbody ${otherJoints[selectedOtherJointIndex].bodyIndexB + 1 - axleTable.length}`
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
          if (Number.isNaN(x)) return;

          trainsTabPanelState.otherJoints[selectedOtherJointIndex].positionB.x = x;
          updateEditingTrain();

        }}
      />
      <TextField
        label="Y"
        value={jointBPositionY}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionY = event.target.value;
          const y = parseFloat(event.target.value);
          if (Number.isNaN(y)) return;

          trainsTabPanelState.otherJoints[selectedOtherJointIndex].positionB.y = y;
          updateEditingTrain();
        }}
      />
      <TextField
        label="Z"
        value={jointBPositionZ}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          formState.jointBPositionZ = event.target.value;
          const z = parseFloat(event.target.value);
          if (Number.isNaN(z)) return;

          trainsTabPanelState.otherJoints[selectedOtherJointIndex].positionB.z = z;
          updateEditingTrain();
        }}
      />
    </Stack>
  </Stack>;
}