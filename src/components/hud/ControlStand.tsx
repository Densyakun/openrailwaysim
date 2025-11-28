import { useSnapshot } from 'valtio';
import { CabFormatType, getDistanceToNextStop, SerializableTrain, Train } from '@/lib/trains';
import MasterController from './MasterController';
import Speed from './Speed';
import { Box, Button, Paper, Stack, SxProps } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { socket } from '../Client';
import { store, toSerializableSaveData, trainTypeId } from '@/lib/game';
import Reverser from './Reverser';
import { trainsState } from '@/lib/client/trains';
import { DiagramTrackRoute, getTimeText, ROUTE_NOT_VIA, TIME_IS_NOT_SET } from '@/lib/diagram';
import { MessageCode, send } from '@/lib/ws';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element;

function TrainDiagramCurve({ train, cabFormat }: { train: Train, cabFormat?: CabFormatType }) {
  const { diagrams } = useSnapshot(store.syncData);

  if (!train.currentDiagramId)
    return <Paper>列車ダイヤ未設定</Paper>;

  const diagram = diagrams[train.currentDiagramId];
  const section = diagram.sections[train.currentDiagramSectionIndex];
  const trackRoute = section.routes[train.currentRouteIndex];
  const diagramCurve = diagram.diagramCurves[train.currentDiagramCurveIndex];

  const distance = getDistanceToNextStop(train, trackRoute as DiagramTrackRoute);

  // TODO 夏時間に対応するため、getTimeTextに渡すDateに日付を追加する
  if (train.isStopping)
    return <Paper>
      {
        `"${section.fromDisplayName}" ${trackRoute.fromPlatformName}`
        + (diagramCurve.passTime[train.currentDiagramSectionIndex] !== TIME_IS_NOT_SET ? ` 発車 ${getTimeText(new Date(diagramCurve.passTime[train.currentDiagramSectionIndex]), section.fromTimezone)}` : "")
      }
    </Paper>;

  // 通過の場合、次のルートから通過時刻を求める
  let nextSectionIndex = -1;
  if (diagramCurve.isPasses[train.currentDiagramSectionIndex])
    for (let i = train.currentDiagramSectionIndex; i < diagramCurve.passTime.length; i++)
      if (diagramCurve.passTime[i] !== ROUTE_NOT_VIA) {
        nextSectionIndex = i;
        break;
      }

  return <Paper>
    {
      `次 "${section.toDisplayName}" ${trackRoute.toPlatformName}`
      + ` ${diagramCurve.isPasses[train.currentDiagramSectionIndex]
        ? `通過${diagramCurve.passTime[nextSectionIndex] !== TIME_IS_NOT_SET ? ` ${getTimeText(new Date(diagramCurve.passTime[nextSectionIndex]), section.toTimezone)}` : ""}`
        : `停車${diagramCurve.stopTime[train.currentDiagramSectionIndex] !== TIME_IS_NOT_SET ? ` ${getTimeText(new Date(diagramCurve.stopTime[train.currentDiagramSectionIndex]), section.toTimezone)}` : ""}`
      }`
      + (distance === undefined ? "" : ` あと ${(Math.ceil(distance * (train.bogies[0].axles[0].rotationIsReversed ? -1 : 1) * (cabFormat?.directionIsReversed ? -1 : 1) * 10) / 10).toFixed(1)} m`)
    }
  </Paper>;
}

export default function ControlStand() {
  const { trains, trainFormats } = useSnapshot(store.syncData);
  useSnapshot(trainsState);

  if (!trainsState.activeTrainId) return null;

  const train = trains[trainsState.activeTrainId];
  if (!train) return null;
  const trainFormat = trainFormats[train.trainFormatId];
  if (!trainFormat) return null;

  const cabFormat = trainsState.activeBodyIndex < train.bogies.length
    ? null
    : trainFormat.cabFormats[trainsState.activeBodyIndex - train.bogies.length];
  const cabState = trainsState.activeBodyIndex < train.bogies.length
    ? null
    : train.cabStates[trainsState.activeBodyIndex - train.bogies.length];

  return <Stack
    direction="row"
    alignItems="flex-end"
    spacing={1}
    sx={{
      width: "100%",
      height: "100%",
    }}
  >
    <Box_ sx={{
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
    }}>
      <Box_ sx={{
        display: "contents",
        alignItems: 'flex-end',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}>
        {cabFormat && cabState && <>
          <Reverser cabState={cabState} />
          <MasterController cabFormat={cabFormat} cabState={cabState} />
        </>}
        <Speed />
        <TrainDiagramCurve train={train as Train} cabFormat={cabFormat || undefined} />
        <Button variant='contained' startIcon={<CloseIcon />} onClick={() => {
          trainsState.activeBodyIndex = -1
          trainsState.activeTrainId = ""
        }}>
          Back
        </Button>
        <Button variant='contained' onClick={() => {
          store.syncData.trains[trainsState.activeTrainId].speed = -16
          send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
            ["trains", trainsState.activeTrainId],
            toSerializableSaveData(
              trainTypeId,
              store.syncData.trains[trainsState.activeTrainId],
              store.syncData
            ) as SerializableTrain])
        }}>
          {`<`}
        </Button>
        <Button variant='contained' onClick={() => {
          store.syncData.trains[trainsState.activeTrainId].speed = 0
          send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
            ["trains", trainsState.activeTrainId],
            toSerializableSaveData(
              trainTypeId,
              store.syncData.trains[trainsState.activeTrainId],
              store.syncData
            ) as SerializableTrain])
        }}>
          {`o`}
        </Button>
        <Button variant='contained' onClick={() => {
          store.syncData.trains[trainsState.activeTrainId].speed = 16
          send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
            ["trains", trainsState.activeTrainId],
            toSerializableSaveData(
              trainTypeId,
              store.syncData.trains[trainsState.activeTrainId],
              store.syncData
            ) as SerializableTrain])
        }}>
          {`>`}
        </Button>
      </Box_>
    </Box_>
    {/*<Box_ sx={{
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: 'center',
      alignItems: 'flex-end',
    }}>
    </Box_>
    <Box_ sx={{
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    }}>
    </Box_>*/}
  </Stack>;
}