import * as THREE from "three";
import { proxy, useSnapshot } from "valtio";
import { Alert, Box, Button, ButtonGroup, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, Menu, MenuItem, Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography, List, ListItem, ListItemSecondaryAction } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { resetEditingTrainState, trainsTabPanelState, triggerPreviewUpdate } from "@/lib/client/trains";
import { useEffect, useState } from "react";
import UIOneHandleMasterControllerConfigTable from "./UIOneHandleMasterControllerConfigTable";
import { serialize, store, trainFormatTypeId, Path, SerializableORSAppDataType } from "@/lib/game";
import { socket } from "../Client";
import { MessageCode, send, MessageValueMap } from "@/lib/ws";
import { TrainFormat, Train, placeTrain, getAxlePosition, getAxleRotation, bogieToAxles, calcJointsToRotateBody, syncOtherBodies, getBodyFromBodyIndex } from "@/lib/trains";
import { cameraControlsState } from "../cameras-and-controls/CameraControls";
import { createStandardTrainFormat, StandardCarFormat, getJNR103SeriesStandardData, convertTrainFormatToStandard, twoAxlesTestCar, twoAxlesTestCarWithBogies, twoBogiesTestCar, twoTestCarsWithJacobsBogies, malletLocomotiveTest, shikiSeries700Test } from "@/lib/trainExamples";

function formatFloat(value: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  return parseFloat(value.toPrecision(12)).toString();
}


export type StandardCarFormatForm = {
  carLength: string;
  bogieDistance: string;
  wheelbase: string;
  axleDiameter: string;
  axleHasMotor: boolean;
  carWeight: string;
};

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
  standardCarFormats: StandardCarFormatForm[];
  standardCarFormatIndexes: number[];
  standardMasterControllerUIOptionId: string;
  standardBulkCouplerOffset: string;
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
  standardBulkCouplerOffset: "0.8",
});

function getPreviewTrainAndTracks(format: TrainFormat): Train | undefined {
  const previewTracks = {
    preview: {
      position: new THREE.Vector3(0, 0, 2500),
      rotationY: Math.PI / 2,
      length: 5000,
      radius: 0,
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
      beginCant: 0,
      endCant: 0,
      trackModels: [],
      gradients: { 0: 0 },
    } as any,
  };

  const { train } = placeTrain(
    format,
    { trackId: "preview", length: 2500 },
    false,
    previewTracks
  );

  if (train) {
    train.trainFormatId = "preview";

    train.bogies.forEach(bogie => {
      bogie.axles.forEach(axle => {
        axle.position.copy(getAxlePosition(axle, previewTracks));
        axle.rotation.copy(getAxleRotation(axle.pointOnTrack, axle.rotationIsReversed, previewTracks));
      });
      bogieToAxles(bogie, previewTracks);
    });

    calcJointsToRotateBody(train, format);
    syncOtherBodies(train, format);
  }

  return train;
}

function focusCamera() {
  const {
    editingTrainFormat,
    selectedCarBodyIndex,
    selectedAxleIndex,
    selectedBodySupporterJointIndex,
    selectedOtherJointIndex,
  } = trainsTabPanelState;
  if (!editingTrainFormat) return;

  const orbitControls = cameraControlsState.controlsRefs["orbitControls"];
  if (!orbitControls) return;

  const oldTarget = orbitControls.target.clone();
  const newTarget = new THREE.Vector3(0, 0, 0);

  const train = getPreviewTrainAndTracks(editingTrainFormat as TrainFormat);
  if (!train) return;

  const toVector3 = (v: any) => new THREE.Vector3(v?.x ?? 0, v?.y ?? 0, v?.z ?? 0);

  if (selectedCarBodyIndex !== -1) {
    if (selectedCarBodyIndex < editingTrainFormat.bogies.length) {
      const bogie = train.bogies[selectedCarBodyIndex];
      if (bogie) {
        newTarget.copy(bogie.position);
        if (selectedAxleIndex !== -1 && bogie.axles[selectedAxleIndex]) {
          newTarget.copy(bogie.axles[selectedAxleIndex].position);
        }
      }
    } else {
      const otherBodyIndex = selectedCarBodyIndex - editingTrainFormat.bogies.length;
      const otherBody = train.otherBodies[otherBodyIndex];
      if (otherBody) {
        newTarget.copy(otherBody.position);
      }
    }
  } else if (selectedBodySupporterJointIndex !== -1 && editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex]) {
    const joint = editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex];
    const otherBody = train.otherBodies[joint.otherBodyIndex];
    const bogie = train.bogies[joint.bogieIndex];

    if (bogie) {
      const baseBody = otherBody || bogie;
      const posA = baseBody.position.clone().add(
        toVector3(joint.otherBodyPosition).applyEuler(baseBody.rotation)
      );
      newTarget.copy(posA);
    }
  } else if (selectedOtherJointIndex !== -1 && editingTrainFormat.otherJoints[selectedOtherJointIndex]) {
    const joint = editingTrainFormat.otherJoints[selectedOtherJointIndex];
    const bodyA = getBodyFromBodyIndex(train, joint.bodyIndexA);
    if (bodyA) {
      const posA = bodyA.position.clone().add(
        toVector3(joint.positionA).applyEuler(bodyA.rotation)
      );
      newTarget.copy(posA);
    }
  }

  const delta = newTarget.clone().sub(oldTarget);
  orbitControls.object.position.add(delta);
  orbitControls.target.copy(newTarget);
  orbitControls.update();
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

  const targetId = newTrainFormatId || editingTrainFormatId;
  if (!targetId) return;

  const serializedTrainFormat = serialize(trainFormatTypeId, editingTrainFormat);

  // If renaming, specify oldPath to server
  const oldPath: Path<SerializableORSAppDataType> | undefined = (editingTrainFormatId && editingTrainFormatId !== targetId)
    ? ["trainFormats", editingTrainFormatId]
    : undefined;

  const messages: [MessageCode.FROM_CLIENT_SET_PROP, MessageValueMap[MessageCode.FROM_CLIENT_SET_PROP]][] = [
    [MessageCode.FROM_CLIENT_SET_PROP, [["trainFormats", targetId], serializedTrainFormat, oldPath]],
  ];

  if (isAddingTrainFormat && selectedTrainGroup && store.data.trainGroups[selectedTrainGroup]) {
    const trainGroup = [...store.data.trainGroups[selectedTrainGroup]];
    trainGroup.push(targetId);
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [["trainGroups", selectedTrainGroup], trainGroup]]);
  }

  if (messages.length > 1) {
    send(socket, MessageCode.FROM_CLIENT_MESSAGES, messages as [MessageCode.FROM_CLIENT_SET_PROP, MessageValueMap[MessageCode.FROM_CLIENT_SET_PROP]][]);
  } else {
    const message = messages[0];
    send(socket, MessageCode.FROM_CLIENT_SET_PROP, message[1]);
  }

  trainsTabPanelState.isAddingTrainFormat = false;
  resetEditingTrainState();
}

export default function TrainFormatEditPanel() {
  const {
    editingTrainFormat,
    editingTrainFormatId,
    isAddingTrainFormat,
    newTrainFormatId,
    selectedCarBodyIndex,
    selectedBodySupporterJointIndex,
    selectedOtherJointIndex,
    directionIsReversed,
    trainIsDeadEnd,
  } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    // スナップショットからではなく、プロキシから直接取得することで依存関係の警告を回避する
    const { newTrainFormatId, editingTrainFormatId, isAddingTrainFormat, editingTrainFormat } = trainsTabPanelState;
    formState.newTrainFormatId = trainsTabPanelState.newTrainFormatId = newTrainFormatId || editingTrainFormatId;
    const initialMode = isAddingTrainFormat ? "standard" : "advanced";
    formState.editingTrainFormatMode = initialMode;

    if (editingTrainFormat) {
      const { carFormats, carFormatIndexes, masterControllerUIOptionId, couplerJointOffset } = convertTrainFormatToStandard(editingTrainFormat as TrainFormat);
      if (carFormats.length > 0) {
        formState.standardCarFormats = carFormats.map(f => ({
          carLength: String(f.carLength),
          bogieDistance: String(f.bogieDistance),
          wheelbase: String(f.wheelbase),
          axleDiameter: String(f.axleDiameter),
          axleHasMotor: f.axleHasMotor,
          carWeight: String(f.carWeight),
        }));
        formState.standardCarFormatIndexes = [...carFormatIndexes];
        formState.standardBulkCouplerOffset = String(couplerJointOffset);
        if (masterControllerUIOptionId) {
          formState.standardMasterControllerUIOptionId = masterControllerUIOptionId;
        }
      } else if (isAddingTrainFormat) {
        // Default car for new format in Standard Mode
        formState.standardCarFormats = [{
          carLength: "20",
          bogieDistance: "13.8",
          wheelbase: "2.1",
          axleDiameter: "0.86",
          axleHasMotor: true,
          carWeight: "0",
        }];
        formState.standardCarFormatIndexes = [0];
        formState.standardBulkCouplerOffset = "0.8";
        if (initialMode === "standard") {
          updateEditingTrainFormatFromStandard();
        }
      }
    }
  }, [editingTrainFormatId]);


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
  const { standardCarFormats, standardCarFormatIndexes, standardMasterControllerUIOptionId, standardBulkCouplerOffset } = formState;
  const couplerOffset = parseFloat(standardBulkCouplerOffset);

  const parsedCarFormats: StandardCarFormat[] = standardCarFormats.map(f => ({
    carLength: parseFloat(f.carLength) || 0,
    bogieDistance: parseFloat(f.bogieDistance) || 0,
    wheelbase: parseFloat(f.wheelbase) || 0,
    axleDiameter: parseFloat(f.axleDiameter) || 0,
    axleHasMotor: f.axleHasMotor,
    carWeight: parseFloat(f.carWeight) || 0,
  }));

  const trainFormat = createStandardTrainFormat(
    parsedCarFormats,
    [...standardCarFormatIndexes],
    standardMasterControllerUIOptionId,
    isNaN(couplerOffset) ? 0.8 : couplerOffset
  );
  trainsTabPanelState.editingTrainFormat = trainFormat;
}

function StandardCarFormatEditor({ index }: { index: number }) {
  const { standardCarFormats } = useSnapshot(formState);
  const carFormat = standardCarFormats[index];

  return <Stack spacing={1} sx={{ p: 1, border: '1px solid #ccc', borderRadius: 1 }}>
    <Typography variant="subtitle2">Car template {index + 1}</Typography>
    <TextField label="Length" size="small" value={carFormat.carLength} onChange={e => {
      formState.standardCarFormats[index].carLength = e.target.value;
      updateEditingTrainFormatFromStandard();
    }} />
    <TextField label="Weight" size="small" value={carFormat.carWeight} onChange={e => {
      formState.standardCarFormats[index].carWeight = e.target.value;
      updateEditingTrainFormatFromStandard();
    }} />
    <TextField label="Bogie distance" size="small" value={carFormat.bogieDistance} onChange={e => {
      formState.standardCarFormats[index].bogieDistance = e.target.value;
      updateEditingTrainFormatFromStandard();
    }} />
    <TextField label="Wheelbase" size="small" value={carFormat.wheelbase} onChange={e => {
      formState.standardCarFormats[index].wheelbase = e.target.value;
      updateEditingTrainFormatFromStandard();
    }} />
    <TextField label="Axle diameter" size="small" value={carFormat.axleDiameter} onChange={e => {
      formState.standardCarFormats[index].axleDiameter = e.target.value;
      updateEditingTrainFormatFromStandard();
    }} />
    <FormControlLabel
      control={
        <Checkbox
          checked={carFormat.axleHasMotor}
          onChange={e => {
            formState.standardCarFormats[index].axleHasMotor = e.target.checked;
            updateEditingTrainFormatFromStandard();
          }}
        />
      }
      label="Has motor"
    />

    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
      formState.standardCarFormats.splice(index, 1);
      // Adjust indexes
      formState.standardCarFormatIndexes = formState.standardCarFormatIndexes.map(i => i >= index ? Math.max(0, i - 1) : i);
      updateEditingTrainFormatFromStandard();
    }}>Delete template</Button>
  </Stack>;
}

function StandardModeEditor() {
  const { standardCarFormats, standardCarFormatIndexes, standardMasterControllerUIOptionId, standardBulkCouplerOffset } = useSnapshot(formState);
  const { oneHandleMasterControllerUIConfigs } = useSnapshot(store.data);
  const { isShowOneHandleMasterControllerConfig } = useSnapshot(trainsTabPanelState);

  return <Stack spacing={2}>
    <Typography variant="h6">Car templates</Typography>

    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, border: '1px solid #ddd', borderRadius: 1 }}>
      <Typography variant="body2" sx={{ minWidth: 120 }}>Coupler offset:</Typography>
      <TextField
        size="small"
        label="Offset value"
        value={standardBulkCouplerOffset}
        onChange={e => {
          formState.standardBulkCouplerOffset = e.target.value;
          updateEditingTrainFormatFromStandard();
        }}
        sx={{ width: 120 }}
      />
    </Stack>

    <Stack spacing={1}>
      {standardCarFormats.map((_, index) => <StandardCarFormatEditor key={index} index={index} />)}
      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => {
        formState.standardCarFormats.push({
          carLength: "20",
          bogieDistance: "13.8",
          wheelbase: "2.1",
          axleDiameter: "0.86",
          axleHasMotor: true,
          carWeight: "0"
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
          {Object.keys(oneHandleMasterControllerUIConfigs).map(id =>
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

function PresetMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const applyStandardPreset = (carFormats: StandardCarFormat[], carFormatIndexes: number[], masterControllerUIOptionId?: string) => {
    formState.standardCarFormats = carFormats.map(f => ({
      carLength: String(f.carLength),
      bogieDistance: String(f.bogieDistance),
      wheelbase: String(f.wheelbase),
      axleDiameter: String(f.axleDiameter),
      axleHasMotor: f.axleHasMotor,
      carWeight: String(f.carWeight),
    }));
    formState.standardCarFormatIndexes = [...carFormatIndexes];
    if (masterControllerUIOptionId) {
      formState.standardMasterControllerUIOptionId = masterControllerUIOptionId;
    }
    formState.editingTrainFormatMode = "standard";
    updateEditingTrainFormatFromStandard();
    handleClose();
  };

  const applyAdvancedPreset = (preset: any) => {
    trainsTabPanelState.editingTrainFormat = JSON.parse(JSON.stringify(preset));
    formState.editingTrainFormatMode = "advanced";
    handleClose();
  };

  return (
    <div>
      <Button
        variant="outlined"
        onClick={handleClick}
        fullWidth
      >
        プリセットを適用
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem onClick={() => {
          const { carFormats, carFormatIndexes } = getJNR103SeriesStandardData();
          applyStandardPreset(carFormats, carFormatIndexes);
        }}>日本国有鉄道103系電車</MenuItem>
        <MenuItem onClick={() => applyAdvancedPreset(twoAxlesTestCar)}>単台車式二軸車</MenuItem>
        <MenuItem onClick={() => applyAdvancedPreset(twoAxlesTestCarWithBogies)}>一軸台車式二軸車</MenuItem>
        <MenuItem onClick={() => {
          const { carFormats, carFormatIndexes, masterControllerUIOptionId } = convertTrainFormatToStandard(twoBogiesTestCar);
          applyStandardPreset(carFormats, carFormatIndexes, masterControllerUIOptionId);
        }}>ボギー車</MenuItem>
        <MenuItem onClick={() => applyAdvancedPreset(twoTestCarsWithJacobsBogies)}>連接台車で連結した2両編成</MenuItem>
        <MenuItem onClick={() => applyAdvancedPreset(malletLocomotiveTest)}>マレー式機関車</MenuItem>
        <MenuItem onClick={() => applyAdvancedPreset(shikiSeries700Test)}>日本国有鉄道シキ700形貨車</MenuItem>
      </Menu>
    </div>
  );
}


function TrainFormatEditor({ trainIsDeadEnd }: { trainIsDeadEnd: boolean }) {
  const {
    isAddingTrainFormat,
    editingTrainFormatId,
    newTrainFormatId,
    editingTrainFormat,
    isSyncPreview,
  } = useSnapshot(trainsTabPanelState);

  const { newTrainFormatId: newTrainFormatIdValue, editingTrainFormatMode } = useSnapshot(formState, { sync: true });
  const { trainFormats, oneHandleMasterControllerUIConfigs } = useSnapshot(store.data);
  const [openConfirmStandard, setOpenConfirmStandard] = useState(false);

  useEffect(() => {
    focusCamera();
  }, []);

  if (!editingTrainFormat) return null;

  const invalidCabIndex = editingTrainFormat.cabFormats.findIndex((cab, index) => {
    if (index >= editingTrainFormat.otherBodyOffsets.length) return false;
    if (!cab) return false;
    return !Object.keys(oneHandleMasterControllerUIConfigs).includes(cab.oneHandleMasterControllerUIConfigId);
  });

  const isDuplicateId = isAddingTrainFormat && Object.keys(trainFormats).includes(newTrainFormatId);
  const isInvalidId = newTrainFormatIdValue.startsWith('__');
  const hasNoBogies = !editingTrainFormat.bogies.length;
  const hasNoAxles = editingTrainFormat.bogies.some(bogie => !bogie.axles.length);
  const hasInvalidCab = 0 <= invalidCabIndex;

  const hasInvalidStandardCab = editingTrainFormatMode === "standard" && (!formState.standardMasterControllerUIOptionId || !Object.keys(oneHandleMasterControllerUIConfigs).includes(formState.standardMasterControllerUIOptionId));

  let hasDisconnectedBodies = false;
  let disconnectedNames: string[] = [];
  if (editingTrainFormat) {
    const numBogies = editingTrainFormat.bogies.length;
    const numOtherBodies = editingTrainFormat.otherBodyOffsets.length;
    const totalNodes = numBogies + numOtherBodies;
    if (totalNodes > 0) {
      const adj: number[][] = Array.from({ length: totalNodes }, () => []);
      editingTrainFormat.bodySupporterJoints.forEach(joint => {
        const { bogieIndex, otherBodyIndex } = joint;
        if (
          bogieIndex >= 0 &&
          bogieIndex < numBogies &&
          otherBodyIndex >= 0 &&
          otherBodyIndex < numOtherBodies
        ) {
          const u = bogieIndex;
          const v = numBogies + otherBodyIndex;
          adj[u].push(v);
          adj[v].push(u);
        }
      });
      editingTrainFormat.otherJoints.forEach(joint => {
        const { bodyIndexA, bodyIndexB } = joint;
        if (
          bodyIndexA >= 0 &&
          bodyIndexA < totalNodes &&
          bodyIndexB >= 0 &&
          bodyIndexB < totalNodes &&
          bodyIndexA !== bodyIndexB
        ) {
          adj[bodyIndexA].push(bodyIndexB);
          adj[bodyIndexB].push(bodyIndexA);
        }
      });

      const visited = new Set<number>();
      const queue: number[] = [0];
      visited.add(0);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbor of adj[curr]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      if (visited.size < totalNodes) {
        hasDisconnectedBodies = true;
        for (let i = 0; i < totalNodes; i++) {
          if (!visited.has(i)) {
            if (i < numBogies) {
              disconnectedNames.push(`Bogie ${i + 1}`);
            } else {
              disconnectedNames.push(`Otherbody ${i + 1 - numBogies}`);
            }
          }
        }
      }
    }
  }

  const hasError = isDuplicateId || isInvalidId || hasNoBogies || hasNoAxles || hasInvalidCab || hasInvalidStandardCab || hasDisconnectedBodies;

  const motorCount = editingTrainFormat.bogies.reduce((sum, bogie) => 
    sum + bogie.axles.filter(a => a.hasMotor).length, 0
  );

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
      const { carFormats, carFormatIndexes, masterControllerUIOptionId, couplerJointOffset } = convertTrainFormatToStandard(editingTrainFormat as TrainFormat);
      formState.standardCarFormats = carFormats.map(f => ({
        carLength: String(f.carLength),
        bogieDistance: String(f.bogieDistance),
        wheelbase: String(f.wheelbase),
        axleDiameter: String(f.axleDiameter),
        axleHasMotor: f.axleHasMotor,
        carWeight: String(f.carWeight),
      }));
      formState.standardCarFormatIndexes = [...carFormatIndexes];
      formState.standardBulkCouplerOffset = String(couplerJointOffset);
      if (masterControllerUIOptionId) {
        formState.standardMasterControllerUIOptionId = masterControllerUIOptionId;
      }
    }

    if (formState.standardCarFormats.length === 0) {
      formState.standardCarFormats = [{
        carLength: "20",
        bogieDistance: "13.8",
        wheelbase: "2.1",
        axleDiameter: "0.86",
        axleHasMotor: true,
        carWeight: "0",
      }];
      formState.standardCarFormatIndexes = [0];
      formState.standardBulkCouplerOffset = "0.8";
    }

    if (!formState.standardMasterControllerUIOptionId && Object.keys(oneHandleMasterControllerUIConfigs).length > 0) {
      formState.standardMasterControllerUIOptionId = Object.keys(oneHandleMasterControllerUIConfigs)[0];
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
    {isInvalidId && <Alert severity="error">
      "__" から始まるIDは指定できません（システム予約語）
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
        {hasDisconnectedBodies && <Alert
          severity="error"
        >
          {`ジョイントされていない分離されたボギーまたはOtherBodyがあります: ${disconnectedNames.join(", ")}`}
        </Alert>
        }
      </>
    )}
    {editingTrainFormatMode === "standard" && hasInvalidStandardCab && (
      <Alert severity="error">
        マスコンを選択してください
      </Alert>
    )}
    <TextField
      label="ID"
      value={newTrainFormatIdValue}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        trainsTabPanelState.newTrainFormatId = formState.newTrainFormatId = event.target.value
      }
    />
    <PresetMenu />
    <Box sx={{ p: 1, bgcolor: "rgba(0, 0, 0, 0.05)", borderRadius: 1, border: "1px solid rgba(0, 0, 0, 0.1)", mt: 0.5, mb: 0.5 }}>
      <Typography variant="body2" fontWeight="bold">
        モーター搭載軸数: {motorCount} 軸
      </Typography>
    </Box>
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
    <FormControlLabel
      control={
        <Checkbox
          size="small"
          checked={isSyncPreview}
          onChange={(event) => {
            trainsTabPanelState.isSyncPreview = event.target.checked;
          }}
        />
      }
      label="プレビュー中に同期 (Sync preview)"
    />
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
    formState.carBodyOffset = formatFloat(editingTrainFormat.bogies[selectedCarBodyIndex].offset);
    formState.carBodyWeight = formatFloat(editingTrainFormat.bogies[selectedCarBodyIndex].weight);
    focusCamera();
  }, [selectedCarBodyIndex, selectedAxleIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
        if (!trainsTabPanelState.editingTrainFormat) return;
        const format = trainsTabPanelState.editingTrainFormat;
        const index = selectedCarBodyIndex;

        // 関連するジョイントの削除とインデックス調整
        format.bodySupporterJoints = format.bodySupporterJoints.filter(j => j.bogieIndex !== index);
        format.bodySupporterJoints.forEach(j => {
          if (j.bogieIndex > index) j.bogieIndex--;
        });
        format.otherJoints = format.otherJoints.filter(j => j.bodyIndexA !== index && j.bodyIndexB !== index);
        format.otherJoints.forEach(j => {
          if (j.bodyIndexA > index) j.bodyIndexA--;
          if (j.bodyIndexB > index) j.bodyIndexB--;
        });

        format.bogies.splice(index, 1);
        if (format.bogies.length > 0) {
          trainsTabPanelState.selectedCarBodyIndex = Math.min(index, format.bogies.length - 1);
        } else {
          trainsTabPanelState.selectedCarBodyIndex = -1;
        }
      }}>Delete bogie</Button>
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
    formState.axleZ = formatFloat(editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].z);
    formState.diameter = formatFloat(editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].diameter);
    formState.hasMotor = editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].hasMotor;
    focusCamera();
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
    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
      if (!trainsTabPanelState.editingTrainFormat) return;
      trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].axles.splice(selectedAxleIndex, 1);
      trainsTabPanelState.selectedAxleIndex = -1;
    }}>Delete axle</Button>
    <TextField
      label="Z"
      value={axleZ}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.axleZ = event.target.value;
        const z = parseFloat(event.target.value);
        if (Number.isNaN(z) || !trainsTabPanelState.editingTrainFormat) return;

        trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].z = z;
        triggerPreviewUpdate();
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
        triggerPreviewUpdate();
      }}
    />
    <FormControlLabel control={<Checkbox size="small" checked={hasMotor} onChange={event => {
      if (!trainsTabPanelState.editingTrainFormat) return;
      trainsTabPanelState.editingTrainFormat.bogies[selectedCarBodyIndex].axles[selectedAxleIndex].hasMotor =
        formState.hasMotor = event.target.checked;
      triggerPreviewUpdate();
    }} />} label="has motor" />
  </Stack>;
}

function OtherBodiesEditor() {
  const { oneHandleMasterControllerUIConfigs } = useSnapshot(store.data);
  const { carBodyOffset, carBodyWeight, hasCab, directionIsReversed, oneHandleMasterControllerUIConfigId } = useSnapshot(formState, { sync: true });
  const { selectedCarBodyIndex, editingTrainFormat, isShowOneHandleMasterControllerConfig } = useSnapshot(trainsTabPanelState);

  useEffect(() => focusCamera(), []);

  useEffect(() => {
    if (selectedCarBodyIndex === -1 || !editingTrainFormat) return;
    const indexInOtherBodies = selectedCarBodyIndex - editingTrainFormat.bogies.length;
    if (indexInOtherBodies < 0 || indexInOtherBodies >= editingTrainFormat.otherBodyOffsets.length) return;

    formState.carBodyOffset = formatFloat(editingTrainFormat.otherBodyOffsets[indexInOtherBodies]);
    formState.carBodyWeight = formatFloat(editingTrainFormat.otherBodyWeights[indexInOtherBodies]);
    
    // Sync cab data to formState when otherbody changes
    const cab = editingTrainFormat.cabFormats[indexInOtherBodies];
    if (cab) {
      formState.hasCab = true;
      formState.directionIsReversed = cab.directionIsReversed;
      formState.oneHandleMasterControllerUIConfigId = cab.oneHandleMasterControllerUIConfigId;
    } else {
      formState.hasCab = false;
      formState.directionIsReversed = false;
      const configs = Object.keys(store.data.oneHandleMasterControllerUIConfigs);
      formState.oneHandleMasterControllerUIConfigId = configs.length > 0 ? configs[0] : '';
    }

    focusCamera();
  }, [selectedCarBodyIndex]);

  useEffect(() => {
    if (!trainsTabPanelState.editingTrainFormat || !editingTrainFormat || selectedCarBodyIndex === -1) return;
    const indexInOtherBodies = selectedCarBodyIndex - editingTrainFormat.bogies.length;
    if (indexInOtherBodies < 0 || indexInOtherBodies >= editingTrainFormat.otherBodyOffsets.length) return;

    trainsTabPanelState.editingTrainFormat.cabFormats[indexInOtherBodies] =
      hasCab && oneHandleMasterControllerUIConfigId
        ? {
          directionIsReversed,
          oneHandleMasterControllerUIConfigId,
        }
        : null;
    triggerPreviewUpdate();
  }, [hasCab, directionIsReversed, oneHandleMasterControllerUIConfigId, selectedCarBodyIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
      if (!trainsTabPanelState.editingTrainFormat) return;
      const format = trainsTabPanelState.editingTrainFormat;
      const indexInOtherBodies = selectedCarBodyIndex - format.bogies.length;
      const globalIndex = selectedCarBodyIndex;

      // 関連するジョイントの削除とインデックス調整
      format.bodySupporterJoints = format.bodySupporterJoints.filter(j => j.otherBodyIndex !== indexInOtherBodies);
      format.bodySupporterJoints.forEach(j => {
        if (j.otherBodyIndex > indexInOtherBodies) j.otherBodyIndex--;
      });
      format.otherJoints = format.otherJoints.filter(j => j.bodyIndexA !== globalIndex && j.bodyIndexB !== globalIndex);
      format.otherJoints.forEach(j => {
        if (j.bodyIndexA > globalIndex) j.bodyIndexA--;
        if (j.bodyIndexB > globalIndex) j.bodyIndexB--;
      });

      format.otherBodyOffsets.splice(indexInOtherBodies, 1);
      format.otherBodyWeights.splice(indexInOtherBodies, 1);
      format.cabFormats.splice(indexInOtherBodies, 1);

      if (format.otherBodyOffsets.length > 0) {
        trainsTabPanelState.selectedCarBodyIndex = format.bogies.length + Math.min(indexInOtherBodies, format.otherBodyOffsets.length - 1);
      } else {
        trainsTabPanelState.selectedCarBodyIndex = -1;
      }
    }}>Delete otherbody</Button>
    <TextField
      label="Offset"
      value={carBodyOffset}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        formState.carBodyOffset = event.target.value;
        const offset = parseFloat(event.target.value);
        if (Number.isNaN(offset) || !trainsTabPanelState.editingTrainFormat) return;

        trainsTabPanelState.editingTrainFormat.otherBodyOffsets[selectedCarBodyIndex - editingTrainFormat.bogies.length] = offset;
        triggerPreviewUpdate();
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
        triggerPreviewUpdate();
      }}
    />
    <Typography variant="h6">Cab</Typography>
    {hasCab && !Object.keys(oneHandleMasterControllerUIConfigs).includes(oneHandleMasterControllerUIConfigId) && <Alert
      severity="error"
    >
      マスコンの形式IDが間違っています
    </Alert>
    }
    <FormControlLabel control={<Checkbox size="small" checked={hasCab} onChange={event => {
      formState.hasCab = event.target.checked;
    }} />} label="has cab" />
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
          error={!Object.keys(oneHandleMasterControllerUIConfigs).includes(oneHandleMasterControllerUIConfigId)}
        >
          {Object.keys(oneHandleMasterControllerUIConfigs).map(id =>
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
    focusCamera();
  }, []);

  useEffect(() => {
    if (selectedBodySupporterJointIndex === -1 || !editingTrainFormat) return;
    formState.jointAPositionX = formatFloat(editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.x);
    formState.jointAPositionY = formatFloat(editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.y);
    formState.jointAPositionZ = formatFloat(editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].otherBodyPosition.z);
    formState.jointBPositionX = formatFloat(editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.x);
    formState.jointBPositionY = formatFloat(editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.y);
    formState.jointBPositionZ = formatFloat(editingTrainFormat.bodySupporterJoints[selectedBodySupporterJointIndex].bogiePosition.z);
    focusCamera();
  }, [selectedBodySupporterJointIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
      if (!trainsTabPanelState.editingTrainFormat) return;
      trainsTabPanelState.editingTrainFormat.bodySupporterJoints.splice(selectedBodySupporterJointIndex, 1);
      trainsTabPanelState.selectedBodySupporterJointIndex = -1;
    }}>Delete joint</Button>
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
        }}
      />
    </Stack>
  </Stack>;
}

function OtherJointsEditor() {
  const { jointAPositionX, jointAPositionY, jointAPositionZ, jointBPositionX, jointBPositionY, jointBPositionZ } = useSnapshot(formState, { sync: true });
  const { editingTrainFormat, selectedOtherJointIndex, isSelectingCarBodyA, isSelectingCarBodyB } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    focusCamera();
  }, []);

  useEffect(() => {
    if (selectedOtherJointIndex === -1 || !editingTrainFormat) return;
    formState.jointAPositionX = formatFloat(editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.x);
    formState.jointAPositionY = formatFloat(editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.y);
    formState.jointAPositionZ = formatFloat(editingTrainFormat.otherJoints[selectedOtherJointIndex].positionA.z);
    formState.jointBPositionX = formatFloat(editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.x);
    formState.jointBPositionY = formatFloat(editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.y);
    formState.jointBPositionZ = formatFloat(editingTrainFormat.otherJoints[selectedOtherJointIndex].positionB.z);
    focusCamera();
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
    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
      if (!trainsTabPanelState.editingTrainFormat) return;
      trainsTabPanelState.editingTrainFormat.otherJoints.splice(selectedOtherJointIndex, 1);
      trainsTabPanelState.selectedOtherJointIndex = -1;
    }}>Delete joint</Button>
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
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
          triggerPreviewUpdate();
        }}
      />
    </Stack>
  </Stack>;
}
