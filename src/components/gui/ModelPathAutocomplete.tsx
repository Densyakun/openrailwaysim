// 3Dモデルのパス入力欄。予測変換と、すでに設定されているモデルパスの一覧選択に対応する (#28)
import { Autocomplete, SxProps, TextField } from '@mui/material';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';

// ストア内に存在する3Dモデルのパスをすべて収集する
export function useModelPathOptions(): string[] {
  const { tracks, trainFormats, worldModels } = useSnapshot(store.data);
  const paths = new Set<string>();

  Object.values(tracks ?? {}).forEach(track => {
    track.trackModels?.forEach(trackModel => {
      if (trackModel?.modelPath) paths.add(trackModel.modelPath);
    });
  });

  Object.values(trainFormats ?? {}).forEach(trainFormat => {
    trainFormat.bogies?.forEach(bogie => {
      if (bogie.modelPath) paths.add(bogie.modelPath);
      bogie.axles?.forEach(axle => {
        if (axle.modelPath) paths.add(axle.modelPath);
      });
    });
    trainFormat.otherBodyModelPaths?.forEach(modelPath => {
      if (modelPath) paths.add(modelPath);
    });
  });

  Object.values(worldModels ?? {}).forEach(worldModel => {
    if (worldModel?.modelPath) paths.add(worldModel.modelPath);
  });

  return Array.from(paths).sort();
}

export default function ModelPathAutocomplete({
  label = 'Model path',
  value,
  onChange,
  size = 'small',
  fullWidth,
  disabled,
  sx,
  textFieldSx,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  disabled?: boolean;
  sx?: SxProps;
  textFieldSx?: SxProps;
}) {
  const options = useModelPathOptions();

  return (
    <Autocomplete
      freeSolo
      autoSelect
      options={options}
      value={value}
      disabled={disabled}
      sx={sx}
      onInputChange={(_event, newInputValue) => onChange(newInputValue)}
      onChange={(_event, newValue) => onChange(typeof newValue === 'string' ? newValue : newValue ?? '')}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          size={size}
          fullWidth={fullWidth}
          sx={textFieldSx}
        />
      )}
    />
  );
}
