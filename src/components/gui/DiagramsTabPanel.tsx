import { useSnapshot } from 'valtio';
import { Fab, Paper, Stack, Tooltip } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import DiagramTable from './DiagramTable';
import { diagramsTabPanelState } from '@/lib/client/diagrams';
import DiagramSectionsEditPanel from './DiagramSectionsEditPanel';
import DiagramCurveEditPanel from './DiagramCurveEditPanel';

function DiagramsMenu() {
  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title="Toggle table" disableInteractive>
        <Fab size="small" color="primary" onClick={() => diagramsTabPanelState.isShowTable = true} sx={{
          pointerEvents: 'auto',
          userSelect: 'none'
        }}>
          <TableViewIcon />
        </Fab>
      </Tooltip>
    </Stack>
  </Paper>;
}

export default function DiagramsTabPanel() {
  const {
    isShowTable,
    editingSectionsInDiagramId,
    editingDiagramCurvesInDiagramId,
  } = useSnapshot(diagramsTabPanelState);

  return isShowTable
    ? editingDiagramCurvesInDiagramId
      ? <DiagramCurveEditPanel />
      : editingSectionsInDiagramId
        ? <DiagramSectionsEditPanel />
        : <DiagramTable />
    : <DiagramsMenu />;
}
