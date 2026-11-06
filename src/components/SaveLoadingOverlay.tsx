import { LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { useSnapshot } from 'valtio';
import { clientState } from '@/lib/client/client';
import { saveLoadState } from '@/lib/client/saveLoading';
import { terrainCsgProgressState } from '@/src/workers/terrainCsgManager';

export default function SaveLoadingOverlay() {
  const saveLoad = useSnapshot(saveLoadState);
  const csg = useSnapshot(terrainCsgProgressState);
  const { saveUrlStatus, saveUrlMessage } = useSnapshot(clientState);

  const urlLoading = saveUrlStatus === 'loading';
  const active = saveLoad.active || csg.isProcessing || urlLoading;

  if (!active) return null;

  const title = urlLoading
    ? 'セーブデータを取得中'
    : saveLoad.active
      ? saveLoad.title
      : '地形を計算中';

  const messages: string[] = [];
  if (urlLoading) messages.push(saveUrlMessage);
  if (saveLoad.active && saveLoad.message) messages.push(saveLoad.message);
  if (saveLoad.active && saveLoad.detail) messages.push(saveLoad.detail);
  if (csg.isProcessing) {
    messages.push(csg.total > 0
      ? `地形と造成データを計算しています（${csg.completed} / ${csg.total}）`
      : '地形と造成データを計算しています...');
  }

  const progress = csg.isProcessing && csg.total > 0
    ? Math.min(100, csg.completed / csg.total * 100)
    : null;

  return <Paper
    elevation={6}
    sx={{
      position: 'fixed',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(420px, calc(100vw - 24px))',
      p: 1.5,
      bgcolor: 'rgba(0,0,0,0.86)',
      color: 'white',
      zIndex: 2000,
      pointerEvents: 'none',
      boxSizing: 'border-box',
    }}
  >
    <Stack spacing={0.75}>
      <Typography variant="subtitle2" fontWeight="bold">{title}</Typography>
      {messages.map((message, index) => (
        <Typography key={index} variant="body2" color="#ccc">{message}</Typography>
      ))}
      <LinearProgress
        variant={progress === null ? 'indeterminate' : 'determinate'}
        value={progress ?? undefined}
        sx={{ borderRadius: 1 }}
      />
    </Stack>
  </Paper>;
}
