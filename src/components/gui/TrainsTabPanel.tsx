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
import TrainFormatTable from './TrainFormatTable';

function TrainsMenu() {
  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title="Toggle train format table" disableInteractive>
        <Fab variant="extended" size="small" color="primary" onClick={() => trainsTabPanelState.isShowTrainFormatTable = true} sx={{
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <TableViewIcon sx={{ mr: 1 }} />
          Formats
        </Fab>
      </Tooltip>
      <Tooltip title="Toggle train table" disableInteractive>
        <Fab variant="extended" size="small" color="primary" onClick={() => trainsTabPanelState.isShowTrainTable = true} sx={{
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <TableViewIcon sx={{ mr: 1 }} />
          Train groups
        </Fab>
      </Tooltip>
    </Stack>
  </Paper>;
}

export default function TrainsTabPanel() {
  const { isShowTrainTable, isShowTrainFormatTable, selectedTrainGroup, isAddingTrainFormat, editingTrainFormatId, isAddingTrain, editingTrainId } = useSnapshot(trainsTabPanelState);
  const { activeTrainId } = useSnapshot(trainsState);

  useEffect(() => {
    guiState.alignItems = (isAddingTrainFormat || editingTrainFormatId) ? "end" : "center";
  }, [isAddingTrainFormat, editingTrainFormatId]);

  return isShowTrainFormatTable
    ? isAddingTrainFormat || editingTrainFormatId
      ? <TrainFormatEditPanel />
      : <TrainFormatTable />
    : isShowTrainTable
      ? selectedTrainGroup
        ? isAddingTrain || editingTrainId
          ? <TrainEditPanel />
          : <TrainTable trainGroupId={selectedTrainGroup} />
        : <TrainGroupTable />
      : activeTrainId
        ? <ControlStand />
        : <TrainsMenu />;
}
