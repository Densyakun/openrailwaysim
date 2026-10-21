import { Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'
import { useSnapshot } from 'valtio'
import { featureCollectionViewState } from '@/lib/client/featureCollections'

/**
 * 3D シーン上の Feature collection をジオメトリ種別ごとに表示/非表示するチェックボックス。
 */
export default function FeatureCollectionFilterControls() {
  const { showLineStrings, showPoints, showPolygons, showOthers } = useSnapshot(featureCollectionViewState);

  return <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
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
      control={<Checkbox size="small" checked={showOthers} onChange={event => {
        featureCollectionViewState.showOthers = event.target.checked;
      }} />}
      label={<Typography variant="body2">その他</Typography>}
    />
  </Stack>;
}
