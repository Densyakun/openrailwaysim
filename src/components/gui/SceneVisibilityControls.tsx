import { Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { useSnapshot } from 'valtio';
import { sceneVisibilityState } from '@/lib/client/sceneVisibility';

/**
 * 邱ｨ髮・ｸｭ縺ｫ縲∫ｷｨ髮・ｸｭ縺ｮ鬆・岼莉･螟悶ｒ蛟句挨縺ｫ髱櫁｡ｨ遉ｺ縺ｫ縺吶ｋ縺溘ａ縺ｮ險ｭ螳壹・ */
export default function SceneVisibilityControls({
  showTrackModels = false,
  showTerrains = true,
  title = '莉悶・鬆・岼縺ｮ陦ｨ遉ｺ',
}: {
  showTrackModels?: boolean;
  showTerrains?: boolean;
  title?: string;
}) {
  const {
    showTrackModels: trackModelsVisible,
    showTerrains: terrainsVisible,
    showBuildings,
    showPlatforms,
    showConstructionZones,
    showTunnels,
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
      {showTerrains && (
        <FormControlLabel
          control={<Checkbox
            size="small"
            checked={terrainsVisible}
            onChange={event => { sceneVisibilityState.showTerrains = event.target.checked; }}
          />}
          label={<Typography variant="body2">地形</Typography>}
        />
      )}
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
      <FormControlLabel
        control={<Checkbox
          size="small"
          checked={showConstructionZones}
          onChange={event => { sceneVisibilityState.showConstructionZones = event.target.checked; }}
        />}
        label={<Typography variant="body2">造成</Typography>}
      />
      <FormControlLabel
        control={<Checkbox
          size="small"
          checked={showTunnels}
          onChange={event => { sceneVisibilityState.showTunnels = event.target.checked; }}
        />}
        label={<Typography variant="body2">トンネル</Typography>}
      />
    </Stack>
  </Stack>;
}


