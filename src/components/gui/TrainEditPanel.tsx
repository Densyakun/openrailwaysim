import { proxy, useSnapshot } from "valtio";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import { placeTrain } from "@/lib/trains";
import { resetEditingTrainState, trainsTabPanelState } from "@/lib/client/trains";
import { useEffect } from "react";
import { getPosition } from "@/lib/tracks";
import { store } from "@/lib/game";
import { v4 as uuidv4 } from 'uuid';
import { socket } from "../Client";
import { setCameraTargetPosition } from "@/lib/client/camera";
import { MessageCode, send } from "@/lib/ws";

const formState = proxy<{
  newTrainId: string;
  trainFormatId: string;
}>({
  newTrainId: "",
  trainFormatId: "",
});

function focusCamera() {
  if (!Object.keys(store.data.tracks).length) return;
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
  }
}

function updateEditingTrain() {
  const {
    pointOnTrack,
    directionIsReversed,
    editingTrain,
    trainFormatId,
  } = trainsTabPanelState;

  if (!Object.keys(store.data.tracks).length) return;
  if (!editingTrain || !pointOnTrack) return;

  const trainFormat = store.data.trainFormats[trainFormatId];
  if (!trainFormat) return;

  const { train, isDeadEnd } = placeTrain(
    trainFormat,
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
  const train = updateEditingTrain();

  const trainGroup = [...store.data.trainGroups[trainsTabPanelState.selectedTrainGroup]];
  trainGroup.push(trainId);

  send(socket, MessageCode.FROM_CLIENT_MESSAGES, [
    [MessageCode.FROM_CLIENT_SET_PROP, [["trains", trainId], train]],
    [MessageCode.FROM_CLIENT_SET_PROP, [["trainGroups", trainsTabPanelState.selectedTrainGroup], trainGroup]],
  ]);

  trainsTabPanelState.isAddingTrainFormat = false;
  resetEditingTrainState();
}

export default function TrainEditPanel() {
  const {
    selectedTrainGroup,
    editingTrain,
    trainFormatId,
    pointOnTrack,
    directionIsReversed,
    trainIsDeadEnd,
  } = useSnapshot(trainsTabPanelState);

  useEffect(() => {
    updateEditingTrain();
  }, [
    trainFormatId,
    pointOnTrack,
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
    <TrainEditor trainIsDeadEnd={trainIsDeadEnd} />
  </Paper>;
}

function TrainEditor({ trainIsDeadEnd }: { trainIsDeadEnd: boolean }) {
  const {
    isAddingTrainFormat,
    selectedTrainGroup,
    editingTrainFormatId,
    newTrainId,
    trainFormatId,
    pointOnTrack,
    directionIsReversed,
    editingTrain,
  } = trainsTabPanelState;

  const { newTrainId: newTrainIdValue } = useSnapshot(formState, { sync: true });
  const { trains } = useSnapshot(store.data);

  useEffect(() => {
    focusCamera();
    formState.newTrainId = newTrainId;
    formState.trainFormatId = trainFormatId;
  }, []);

  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
        trainsTabPanelState.isAddingTrain = false;
        trainsTabPanelState.editingTrainId = "";
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
    {trainIsDeadEnd && <Alert severity="error">
      列車が軌道の外に出ています
    </Alert>
    }
    <TextField
      label="ID"
      value={newTrainIdValue}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        trainsTabPanelState.newTrainId = formState.newTrainId = event.target.value
      }
    />
    <TextField
      label="Train format ID"
      value={trainFormatId}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        trainsTabPanelState.trainFormatId = formState.trainFormatId = event.target.value
      }
    />
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
