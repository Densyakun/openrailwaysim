import { useSnapshot } from 'valtio';
import { 
  Paper, 
  Stack, 
  Tooltip, 
  Button, 
  Box, 
  IconButton, 
  Divider, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormControlLabel, 
  Switch,
  Typography
} from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import PlaceIcon from '@mui/icons-material/Place';
import TrainIcon from '@mui/icons-material/Train';
import CloseIcon from '@mui/icons-material/Close';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import ControlStand from '../hud/ControlStand';
import TrainGroupTable from './TrainGroupTable';
import TrainTable from './TrainTable';
import TrainFormatEditPanel from './TrainFormatEditPanel';
import { trainsState, trainsTabPanelState } from '@/lib/client/trains';
import { useEffect } from 'react';
import { guiState } from '@/lib/client/gui';
import TrainFormatTable from './TrainFormatTable';
import TrainAddPanel from './TrainAddPanel';
import { store } from '@/lib/game';
import { Train, TrainFormat } from '@/lib/trains';
import { setCameraTargetPosition } from '@/lib/client/camera';

function TrainsMenu() {
  const { selectedTrainId, selectedBodyIndex, isCameraFollowing, activeTrainId, activeBodyIndex } = useSnapshot(trainsState);
  const { trains, trainFormats } = useSnapshot(store.data);

  const selectedTrain = selectedTrainId ? (trains[selectedTrainId] as Train | undefined) : undefined;
  const selectedFormat = selectedTrain ? (trainFormats[selectedTrain.trainFormatId] as TrainFormat | undefined) : undefined;

  // 運転台（Cab）の抽出
  const cabList: { index: number; name: string }[] = [];
  if (selectedTrain && selectedFormat) {
    selectedFormat.cabFormats.forEach((cabFormat, i) => {
      if (cabFormat) {
        cabList.push({
          index: i,
          name: `運転台 ${i + 1}`
        });
      }
    });
  }

  return (
    <Stack spacing={1}>
      {/* メインメニューの基本ボタン */}
      <Paper sx={{
        p: 1.5,
        pointerEvents: 'auto',
        userSelect: 'none',
        display: "flex",
        flexDirection: "row",
        gap: 1,
        alignItems: "center"
      }}>
        <Tooltip title="Show train format table" disableInteractive>
          <Button variant="contained" size="small" startIcon={<TableViewIcon />} onClick={() => trainsTabPanelState.isShowTrainFormatTable = true}>
            Formats
          </Button>
        </Tooltip>
        <Tooltip title="Show train table" disableInteractive>
          <Button variant="contained" size="small" startIcon={<TableViewIcon />} onClick={() => trainsTabPanelState.isShowTrainTable = true}>
            Train groups
          </Button>
        </Tooltip>
      </Paper>

      {/* 選択された列車のコントロールメニュー */}
      {selectedTrain && (
        <Paper sx={{
          p: 2,
          pointerEvents: 'auto',
          userSelect: 'none',
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          width: 300,
          bgcolor: "rgba(0,0,0,0.85)",
          color: "white",
        }}>
          {/* ヘッダー */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <TrainIcon color="primary" />
              <Typography variant="subtitle1" fontWeight="bold">
                {selectedTrainId}
              </Typography>
            </Stack>
            <IconButton size="small" color="inherit" onClick={() => {
              trainsState.selectedTrainId = "";
              trainsState.selectedBodyIndex = -1;
              trainsState.isCameraFollowing = false;
            }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.15)" }} />


          {/* カメラのフォーカス & 追従スイッチ */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <FormControlLabel
              control={
                <Switch 
                  size="small"
                  checked={isCameraFollowing} 
                  onChange={(e) => {
                    trainsState.isCameraFollowing = e.target.checked;
                  }}
                />
              }
              label={<Typography variant="caption">カメラ自動追従</Typography>}
            />
            
            <Button
              variant="outlined"
              size="small"
              startIcon={<PlaceIcon />}
              sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)" }}
              onClick={() => {
                const bogiesLength = selectedTrain.bogies?.length ?? 0;
                const targetBodyIndex = selectedBodyIndex !== -1 ? selectedBodyIndex : 0;
                const selectedBody = targetBodyIndex < bogiesLength
                  ? selectedTrain.bogies?.[targetBodyIndex]
                  : selectedTrain.otherBodies?.[targetBodyIndex - bogiesLength];
                if (selectedBody && selectedBody.position) {
                  setCameraTargetPosition(selectedBody.position);
                }
              }}
            >
              フォーカス
            </Button>
          </Box>

          {/* 運転台乗り込み */}
          {cabList.length > 0 && (
            <>
              <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.15)" }} />
              <Stack spacing={1}>
                {cabList.map((cab) => {
                  const bodyIndex = selectedTrain.bogies.length + cab.index;
                  const isDriving = activeTrainId === selectedTrainId && activeBodyIndex === bodyIndex;
                  
                  return (
                    <Button
                      key={`menu-cab-${cab.index}`}
                      variant={isDriving ? "contained" : "outlined"}
                      color={isDriving ? "secondary" : "primary"}
                      size="small"
                      startIcon={<SportsEsportsIcon />}
                      onClick={() => {
                        if (isDriving) {
                          trainsState.activeTrainId = "";
                          trainsState.activeBodyIndex = -1;
                        } else {
                          trainsState.activeTrainId = selectedTrainId;
                          trainsState.activeBodyIndex = bodyIndex;
                        }
                      }}
                    >
                      {isDriving ? "降車する" : `${cab.name} 運転`}
                    </Button>
                  );
                })}
              </Stack>
            </>
          )}
        </Paper>
      )}
    </Stack>
  );
}

export default function TrainsTabPanel() {
  const { isShowTrainTable, isShowTrainFormatTable, selectedTrainGroup, isAddingTrainFormat, editingTrainFormatId, isAddingTrain } = useSnapshot(trainsTabPanelState);
  const { activeTrainId } = useSnapshot(trainsState);

  useEffect(() => {
    guiState.alignItems = (isAddingTrainFormat || editingTrainFormatId || isAddingTrain) ? "end" : "center";
  }, [isAddingTrainFormat, editingTrainFormatId, isAddingTrain]);

  return isShowTrainFormatTable
    ? isAddingTrainFormat || editingTrainFormatId
      ? <TrainFormatEditPanel />
      : <TrainFormatTable />
    : isShowTrainTable
      ? selectedTrainGroup
        ? isAddingTrain
          ? <TrainAddPanel />
          : <TrainTable trainGroupId={selectedTrainGroup} />
        : <TrainGroupTable />
      : activeTrainId
        ? <ControlStand />
        : <TrainsMenu />;
}
