import { useSnapshot } from 'valtio';
import { Fab, Paper, Stack, Tooltip } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import ControlStand from '../hud/ControlStand';
import TrainGroupTable from './TrainGroupTable';
import TrainTable from './TrainTable';
import TrainFormatEditPanel from './TrainFormatEditPanel';
import { trainsState, trainsTabPanelState } from '@/lib/client/trains';
import { useEffect } from 'react';
import { guiState } from '@/lib/client/gui';
import TrainEditPanel from './TrainEditPanel';

function TrainsMenu() {
  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title="Toggle table" disableInteractive>
        <Fab size="small" color="primary" onClick={() => trainsTabPanelState.isShowTable = true} sx={{
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <TableViewIcon />
        </Fab>
      </Tooltip>
    </Stack>
  </Paper>;
}

export default function TrainsTabPanel() {
  const { isShowTable, selectedTrainGroup, isAddingTrainFormat, editingTrainFormatId, isAddingTrain, editingTrainId } = useSnapshot(trainsTabPanelState);
  const { activeTrainId } = useSnapshot(trainsState);

  useEffect(() => {
    guiState.alignItems = (isAddingTrainFormat || editingTrainFormatId) ? "end" : "center";
  }, [isAddingTrainFormat, editingTrainFormatId]);

  // TODO TrainFormatはTrainGroupからではなく、TrainFormatTableから
  return isShowTable
    ? selectedTrainGroup
      ? isAddingTrainFormat || editingTrainFormatId
        ? isAddingTrain || editingTrainId
          ? <TrainEditPanel />
          : <TrainFormatEditPanel />
        : <TrainTable trainGroupId={selectedTrainGroup} />
      : <TrainGroupTable />
    : activeTrainId
      ? <ControlStand />
      : <TrainsMenu />;
}
