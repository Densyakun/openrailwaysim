import { Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { useSnapshot } from 'valtio';
import { sceneVisibilityState } from '@/lib/client/sceneVisibility';

/**
 * 編集中に、編集中の項目以外を個別に非表示にするための設定。
 */
export default function SceneVisibilityControls({
  showTrackModels = false,
  title = '他の項目の表示',
}: {
  showTrackModels?: boolean;
  title?: string;
}) {
  const {
    showTrackModels: trackModelsVisible,
    showTerrains,
    showBuildings,
    showPlatforms,
  } = useSnapshot(sceneVisibilityState);

  return <Stack spacing={0.5}>
    <Typography variant="subtitle2">{title}</Typography>
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      {showTrackModels && (
        <FormControlLabel
          control={<Checkbox
            size="small"
            checked={trackModelsVisible}
            onChange={event => { sceneVisibilityState.showTrackModels = event.target.checked; }}
          />}
          label={<Typography variant="body2">軌道3Dモデル</Typography>}
        />
      )}
      <FormControlLabel
        control={<Checkbox
          size="small"
          checked={showTerrains}
          onChange={event => { sceneVisibilityState.showTerrains = event.target.checked; }}
        />}
        label={<Typography variant="body2">地形</Typography>}
      />
      <FormControlLabel
        control={<Checkbox
          size="small"
          checked={showBuildings}
          onChange={event => { sceneVisibilityState.showBuildings = event.target.checked; }}
        />}
        label={<Typography variant="body2">建物</Typography>}
      />
      <FormControlLabel
        control={<Checkbox
          size="small"
          checked={showPlatforms}
          onChange={event => { sceneVisibilityState.showPlatforms = event.target.checked; }}
        />}
        label={<Typography variant="body2">プラットフォーム</Typography>}
      />
    </Stack>
  </Stack>;
}
