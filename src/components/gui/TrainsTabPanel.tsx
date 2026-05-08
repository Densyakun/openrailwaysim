import { useSnapshot } from 'valtio';
import { Paper, Stack, Tooltip, Button } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import ControlStand from '../hud/ControlStand';
import TrainGroupTable from './TrainGroupTable';
import TrainTable from './TrainTable';
import TrainFormatEditPanel from './TrainFormatEditPanel';
import { trainsState, trainsTabPanelState } from '@/lib/client/trains';
import { useEffect } from 'react';
import { guiState } from '@/lib/client/gui';
import TrainFormatTable from './TrainFormatTable';
import TrainAddPanel from './TrainAddPanel';

function TrainsMenu() {
  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction="row" spacing={1} alignItems="center">
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
    </Stack>
  </Paper>;
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
