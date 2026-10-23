import {
  Checkbox, FormControlLabel, MenuItem, Select, Stack, Typography,
} from '@mui/material'
import { useSnapshot } from 'valtio'
import { featureCollectionViewState } from '@/lib/client/featureCollections'

/**
 * 3D シーン上の Feature collection の表示設定。
 * ジオメトリ種別の表示/非表示と、点ラベルの表示方法を切り替える。
 */
export default function FeatureCollectionFilterControls() {
  const {
    showLineStrings, showPoints, showPolygons, showOthers, showBuildings, pointLabelMode,
  } = useSnapshot(featureCollectionViewState);

  return <Stack spacing={0.5}>
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <Typography variant="caption" color="text.secondary">3D 表示:</Typography>
      <FormControlLabel
        control={<Checkbox size="small" checked={showLineStrings} onChange={event => {
          featureCollectionViewState.showLineStrings = event.target.checked;
        }} />}
        label={<Typography variant="body2">線</Typography>}
      />
      <FormControlLabel
        control={<Checkbox size="small" checked={showPoints} onChange={event => {
          featureCollectionViewState.showPoints = event.target.checked;
        }} />}
        label={<Typography variant="body2">点</Typography>}
      />
      <FormControlLabel
        control={<Checkbox size="small" checked={showPolygons} onChange={event => {
          featureCollectionViewState.showPolygons = event.target.checked;
        }} />}
        label={<Typography variant="body2">面</Typography>}
      />
      <FormControlLabel
        control={<Checkbox size="small" checked={showBuildings} onChange={event => {
          featureCollectionViewState.showBuildings = event.target.checked;
        }} />}
        label={<Typography variant="body2">建物</Typography>}
      />
      <FormControlLabel
        control={<Checkbox size="small" checked={showOthers} onChange={event => {
          featureCollectionViewState.showOthers = event.target.checked;
        }} />}
        label={<Typography variant="body2">その他</Typography>}
      />
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" color="text.secondary">点ラベル:</Typography>
      <Select
        size="small"
        value={pointLabelMode}
        onChange={event => {
          featureCollectionViewState.pointLabelMode = event.target.value as typeof pointLabelMode;
        }}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="auto">自動（点数が少ないとき）</MenuItem>
        <MenuItem value="all">すべて表示</MenuItem>
        <MenuItem value="hover">ホバーのみ</MenuItem>
      </Select>
      {pointLabelMode === 'all'
        ? <Typography variant="caption" color="warning.main">点数が多いと重くなります。</Typography>
        : null}
    </Stack>
  </Stack>;
}
