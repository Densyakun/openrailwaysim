import { useEffect, useState } from 'react'
import {
  Button, Divider, FormControlLabel, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ApartmentIcon from '@mui/icons-material/Apartment'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useSnapshot } from 'valtio'
import { buildingGenerationSettings } from '@/lib/client/buildings'
import { featureCollectionViewState } from '@/lib/client/featureCollections'
import { buildingFloorHeight } from '@/lib/buildings'
import { featureCollectionsTabPanelState } from './FeatureCollectionsTabPanel'

const defaultFollowTerrain = true
const defaultFoundationDepth = 2
const defaultSeed = 1

function NumberSettingField({
  label,
  value,
  min,
  max,
  integer,
  onChange,
  helperText,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  onChange: (value: number) => void;
  helperText?: string;
}) {
  const [text, setText] = useState(String(value))
  const [isInvalid, setIsInvalid] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (isFocused) return;

    setText(String(value));
    setIsInvalid(false);
  }, [value, isFocused]);

  const clamp = (number: number) => {
    const rounded = integer ? Math.round(number) : number
    return Math.min(max, Math.max(min, rounded))
  }

  const handleChange = (nextText: string) => {
    setText(nextText);

    const parsed = Number.parseFloat(nextText);
    if (!Number.isFinite(parsed)) {
      setIsInvalid(true);
      return;
    }

    setIsInvalid(false);
    onChange(clamp(parsed));
  }

  const handleBlur = () => {
    setIsFocused(false);

    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      setIsInvalid(false);
      return;
    }

    const nextValue = clamp(parsed);
    setText(String(nextValue));
    setIsInvalid(false);
    onChange(nextValue);
  }

  return <TextField
    size="small"
    label={label}
    value={text}
    onFocus={() => setIsFocused(true)}
    onChange={event => handleChange(event.target.value)}
    onBlur={handleBlur}
    error={isInvalid}
    helperText={isInvalid ? '数値を入力してください。' : helperText}
  />;
}

export default function BuildingSettingsPanel() {
  const { showBuildings } = useSnapshot(featureCollectionViewState);
  const {
    followTerrain, foundationDepth, floorHeight, seed, variation,
  } = useSnapshot(buildingGenerationSettings);

  return <Paper sx={{
    p: 1.5,
    pointerEvents: 'auto',
    userSelect: 'none',
    width: 'min(460px, 92vw)',
    maxHeight: 'calc(100vh - 140px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  }}>
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => {
          featureCollectionsTabPanelState.isEditingBuildings = false;
        }}>
          Back
        </Button>
        <ApartmentIcon />
        <Typography variant="h6">建物の設定</Typography>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        OSM の建物 Polygon から生成する 3D 建物の設定です。
        変更すると表示中の建物が再生成されます。
      </Typography>

      <FormControlLabel
        control={<Switch checked={showBuildings} onChange={event => {
          featureCollectionViewState.showBuildings = event.target.checked;
        }} />}
        label="建物を表示する"
      />

      <Divider />

      <Typography variant="subtitle2" fontWeight="bold">地形</Typography>
      <FormControlLabel
        control={<Switch checked={followTerrain} onChange={event => {
          buildingGenerationSettings.followTerrain = event.target.checked;
        }} />}
        label="地形の高さに合わせる"
      />
      <Typography variant="caption" color="text.secondary">
        footprint 周辺の地形をサンプリングし、基礎を地形の低い位置まで伸ばします。
      </Typography>
      <NumberSettingField
        label="基礎の深さ (m)"
        value={foundationDepth}
        min={0}
        max={20}
        onChange={value => { buildingGenerationSettings.foundationDepth = value }}
        helperText="傾斜地で建物の下に隙間ができないようにする深さです。"
      />

      <Divider />

      <Typography variant="subtitle2" fontWeight="bold">形状</Typography>
      <NumberSettingField
        label="階高 (m)"
        value={floorHeight}
        min={2}
        max={10}
        onChange={value => { buildingGenerationSettings.floorHeight = value }}
        helperText="building:levels から高さを計算するときに使います。"
      />
      <FormControlLabel
        control={<Switch checked={variation} onChange={event => {
          buildingGenerationSettings.variation = event.target.checked;
        }} />}
        label="建物のバリエーションを使う"
      />
      <Typography variant="caption" color="text.secondary">
        屋根形状・ファサードの窓間隔・色を建物ごとに決定的に変化させます。
      </Typography>
      <NumberSettingField
        label="生成シード"
        value={seed}
        min={0}
        max={999_999_999}
        integer
        onChange={value => { buildingGenerationSettings.seed = value }}
        helperText="同じシードと建物 @id からは常に同じ外観が生成されます。"
      />

      <Divider />

      <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={() => {
        buildingGenerationSettings.followTerrain = defaultFollowTerrain;
        buildingGenerationSettings.foundationDepth = defaultFoundationDepth;
        buildingGenerationSettings.floorHeight = buildingFloorHeight;
        buildingGenerationSettings.seed = defaultSeed;
        buildingGenerationSettings.variation = true;
      }}>
        設定をリセット
      </Button>
    </Stack>
  </Paper>;
}
