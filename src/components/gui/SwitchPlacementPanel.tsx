import * as React from 'react';
import { useSnapshot } from 'valtio';
import { v4 as uuidv4 } from 'uuid';
import { Alert, Button, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { getSwitchAngle, createSwitchTracks } from '@/lib/tracks';
import { store, SerializableORSAppDataType, Path, PathValue } from '@/lib/game';
import { socket } from '../Client';
import { MessageCode, send } from '@/lib/ws';
import { switchPlacementState } from '@/lib/client/switchPlacement';
import { tracksState } from '@/lib/client/tracks/store';

export default function SwitchPlacementPanel() {
  const {
    isPlacing,
  } = useSnapshot(switchPlacementState);

  if (!isPlacing) {
    return <SwitchPlacementStart />;
  }

  return <SwitchPlacementEditor />;
}

function SwitchPlacementStart() {
  return <Paper sx={{ p: 1, pointerEvents: 'auto', userSelect: 'none', maxWidth: 'min(420px,90vw)', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
    <Stack direction="column" spacing={1}>
      <Typography variant="subtitle1">分岐器を敷設</Typography>
      <Alert severity="info">
        分岐番数を指定して分岐器を敷設します。<br />
        本線を選択し、交点位置を指定してください。
      </Alert>
      <Button
        variant="contained"
        onClick={() => {
          switchPlacementState.isPlacing = true;
          tracksState.selectedTrackIds.splice(0);
        }}
      >
        敷設開始
      </Button>
    </Stack>
  </Paper>;
}

function SwitchPlacementEditor() {
  const {
    mainTrackId,
    mainTrackLength,
    switchNumber,
    isJapanese,
    isDivergeLeft,
    divergingLength,
  } = useSnapshot(switchPlacementState, { sync: true });
  const { pointingOnTrack, selectedTrackIds } = useSnapshot(tracksState);

  const [localSwitchNumber, setLocalSwitchNumber] = React.useState(switchNumber.toString());
  const [localDivergingLength, setLocalDivergingLength] = React.useState(divergingLength.toString());

  const updatePreview = React.useCallback(() => {
    if (!mainTrackId) return;

    const mainTrack = store.data.tracks[mainTrackId];
    if (!mainTrack) return;

    const num = parseFloat(localSwitchNumber);
    const divLen = parseFloat(localDivergingLength);
    if (isNaN(num) || num <= 0 || isNaN(divLen) || divLen <= 0) {
      switchPlacementState.previewTracks = [];
      return;
    }

    const result = createSwitchTracks(
      mainTrack,
      mainTrackLength,
      num,
      isJapanese,
      isDivergeLeft,
      divLen,
      mainTrack.trackModels,
    );

    switchPlacementState.previewTracks = [
      result.mainTrackBefore,
      result.mainTrackAfter,
      result.divergingTrack,
    ];
  }, [mainTrackId, mainTrackLength, isJapanese, isDivergeLeft, localSwitchNumber, localDivergingLength]);

  React.useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // pointingOnTrackの変化に応じてmainTrackLengthを更新
  React.useEffect(() => {
    if (pointingOnTrack && mainTrackId === pointingOnTrack.trackId) {
      switchPlacementState.mainTrackLength = pointingOnTrack.length;
    }
  }, [pointingOnTrack, mainTrackId]);

  // selectedTrackIdsの変化に応じてmainTrackIdを更新
  React.useEffect(() => {
    if (selectedTrackIds.length === 1) {
      switchPlacementState.mainTrackId = selectedTrackIds[0];
      switchPlacementState.mainTrackLength = 0;
    } else if (selectedTrackIds.length === 0) {
      switchPlacementState.mainTrackId = "";
    }
  }, [selectedTrackIds]);

  const angle = getSwitchAngle(parseFloat(localSwitchNumber) || switchNumber, isJapanese);
  const angleDeg = (angle * 180 / Math.PI);

  const handlePlace = () => {
    if (!mainTrackId) return;

    const mainTrack = store.data.tracks[mainTrackId];
    if (!mainTrack) return;

    const num = parseFloat(localSwitchNumber);
    const divLen = parseFloat(localDivergingLength);
    if (isNaN(num) || num <= 0 || isNaN(divLen) || divLen <= 0) return;

    const result = createSwitchTracks(
      mainTrack,
      mainTrackLength,
      num,
      isJapanese,
      isDivergeLeft,
      divLen,
      mainTrack.trackModels,
    );

    const mainAfterId = uuidv4();
    const divergingId = uuidv4();
    const switchId = uuidv4();

    const messages: [MessageCode.FROM_CLIENT_SET_PROP, [Path<SerializableORSAppDataType>, PathValue<SerializableORSAppDataType, Path<SerializableORSAppDataType>>, Path<SerializableORSAppDataType>?]][] = [];

    // 本線の前半を更新
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", mainTrackId],
      {
        ...result.mainTrackBefore,
        idOfTrackOrSwitchConnectedFromEnd: switchId,
        connectedFromEndIsTrack: false,
      },
    ]]);

    // 本線の後半を作成
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", mainAfterId],
      {
        ...result.mainTrackAfter,
        idOfTrackOrSwitchConnectedFromStart: switchId,
        connectedFromStartIsTrack: false,
        idOfTrackOrSwitchConnectedFromEnd: mainTrack.idOfTrackOrSwitchConnectedFromEnd,
        connectedFromEndIsTrack: mainTrack.connectedFromEndIsTrack,
        connectedFromEndIsToEnd: mainTrack.connectedFromEndIsToEnd,
      },
    ]]);

    // 分岐側の軌道を作成
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", divergingId],
      result.divergingTrack,
    ]]);

    // 分岐器を作成
    const railroadSwitch = {
      connectedTrackIds: [mainAfterId, divergingId],
      isConnectedToEnd: [false, false],
      currentConnected: 0,
    };
    messages.push([MessageCode.FROM_CLIENT_SET_PROP, [
      ["switches", switchId],
      railroadSwitch,
    ]]);

    send(socket, MessageCode.FROM_CLIENT_MESSAGES, messages);

    // 状態をリセット
    switchPlacementState.isPlacing = false;
    switchPlacementState.mainTrackId = "";
    switchPlacementState.previewTracks = [];
    tracksState.selectedTrackIds.splice(0);
  };

  return <Paper sx={{ p: 1, pointerEvents: 'auto', userSelect: 'none', maxWidth: 'min(420px,90vw)', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
    <Stack direction="column" spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <div>分岐器敷設</div>
        <Button variant="outlined" size="small" onClick={() => {
          switchPlacementState.isPlacing = false;
          switchPlacementState.mainTrackId = "";
          switchPlacementState.previewTracks = [];
          tracksState.selectedTrackIds.splice(0);
        }}>
          <ArrowBackIcon />
        </Button>
      </Stack>

      {!mainTrackId ? (
        <Alert severity="info">本線となる軌道をクリックして選択してください</Alert>
      ) : (
        <Alert severity="success">
          本線: {mainTrackId.slice(0, 8)}... | 交点位置: {mainTrackLength.toFixed(1)}m
        </Alert>
      )}

      <TextField
        label="分岐番数"
        value={localSwitchNumber}
        size="small"
        type="number"
        onChange={(event) => {
          setLocalSwitchNumber(event.target.value);
          const num = parseFloat(event.target.value);
          if (!isNaN(num) && num > 0) {
            switchPlacementState.switchNumber = num;
          }
        }}
        onBlur={() => updatePreview()}
      />

      <Typography variant="caption" color="text.secondary">
        分岐角: {angleDeg.toFixed(2)}° ({isJapanese ? '日本式 tan' : '欧州式 sin'})
      </Typography>

      <RadioGroup
        row
        value={isJapanese ? 'japanese' : 'european'}
        onChange={(event) => {
          switchPlacementState.isJapanese = event.target.value === 'japanese';
          updatePreview();
        }}
      >
        <FormControlLabel value="japanese" control={<Radio size="small" />} label="日本式 (tan)" />
        <FormControlLabel value="european" control={<Radio size="small" />} label="欧州式 (sin)" />
      </RadioGroup>

      <RadioGroup
        row
        value={isDivergeLeft ? 'left' : 'right'}
        onChange={(event) => {
          switchPlacementState.isDivergeLeft = event.target.value === 'left';
          updatePreview();
        }}
      >
        <FormControlLabel value="left" control={<Radio size="small" />} label="左分岐" />
        <FormControlLabel value="right" control={<Radio size="small" />} label="右分岐" />
      </RadioGroup>

      <TextField
        label="分岐側長さ (m)"
        value={localDivergingLength}
        size="small"
        type="number"
        onChange={(event) => {
          setLocalDivergingLength(event.target.value);
          const len = parseFloat(event.target.value);
          if (!isNaN(len) && len > 0) {
            switchPlacementState.divergingLength = len;
          }
        }}
        onBlur={() => updatePreview()}
      />

      <Button
        variant="contained"
        startIcon={<SaveIcon />}
        disabled={!mainTrackId}
        onClick={handlePlace}
      >
        敷設
      </Button>
    </Stack>
  </Paper>;
}
