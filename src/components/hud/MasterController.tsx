import { Box, Paper, Slider } from '@mui/material';
import { CabFormatType, CabStateType, UIOneHandleMasterControllerConfig } from '@/lib/trains';
import { socket } from '../Client';
import { trainsState } from '@/lib/client/trains';
import { MessageCode, send } from '@/lib/ws';
import { useSnapshot } from 'valtio';
import { store } from '@/lib/game';

export function MasterControllerSlider({ value, uiOneHandleMasterControllerConfig, setValue }: { value: number, uiOneHandleMasterControllerConfig: UIOneHandleMasterControllerConfig, setValue: (newValue: number) => void }) {
  const { marks, maxValue, nValue, stepRangeList, steps } = uiOneHandleMasterControllerConfig;

  const handleChange = (event: Event, newValue: number | number[]) => {
    const newValue_ = newValue as number;

    const getNewValue = (newValue: number) => {
      if (steps.length === 0) return newValue;

      for (const stepRange of stepRangeList)
        if (stepRange[0] <= newValue && newValue <= stepRange[1]) {
          for (let stepIndex = 0; stepIndex <= steps.length - 2; stepIndex++)
            if (steps[stepIndex] <= newValue && newValue <= steps[stepIndex + 1])
              return newValue < steps[stepIndex] + (steps[stepIndex + 1] - steps[stepIndex]) / 2
                ? steps[stepIndex]
                : steps[stepIndex + 1];

          const minValue = Math.min(...steps);
          if (newValue < minValue)
            return minValue;

          const maxValue = Math.max(...steps);
          if (maxValue < newValue)
            return maxValue;
        }

      return newValue;
    }

    setValue(getNewValue(newValue_));
  };

  const trackColor = value < nValue ? "#00ff00" : "#ffff00"

  return (
    <Box sx={{
      width: "90px",
      height: "320px",
    }}>
      <Box sx={{
        position: "relative",
        display: "contents",
      }}>
        <Paper sx={{
          position: "absolute",
          width: "90px",
          height: "320px",
          px: 1,
          py: 2,
        }}>
          {/* Separate slider to display track from n step to value */}
          <Slider
            sx={{
              pointerEvents: 'none',
              '& input[type="range"]': {
                WebkitAppearance: 'slider-vertical',
              },
              '& .MuiSlider-thumb': {
                height: 16,
                width: 32,
                opacity: 0,
              },
              '& .MuiSlider-track': {
                opacity: 1,
                color: trackColor,
                transition: 'initial',
              },
              '& .MuiSlider-rail': {
                opacity: 1,
                color: "#acc4e4",
              },
            }}
            orientation="vertical"
            marks={marks}
            max={maxValue}
            value={value < nValue ? [value, nValue] : [nValue, value]}
          />
        </Paper>
        <Box sx={{
          position: "absolute",
          width: "90px",
          height: "320px",
          px: 1,
          py: 2,
        }}>
          {/* Controllable slider */}
          <Slider
            sx={{
              '& input[type="range"]': {
                WebkitAppearance: 'slider-vertical',
              },
              '& .MuiSlider-thumb': {
                height: 16,
                width: 32,
                backgroundColor: '#bfbfbf',
                transition: 'initial',
              },
              '& .MuiSlider-track': {
                transition: 'initial',
                opacity: 0,
              },
              '& .MuiSlider-rail': {
                opacity: 0,
              },
            }}
            orientation="vertical"
            max={maxValue}
            value={value}
            step={0.1}
            onChange={handleChange}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default function MasterController({
  cabFormat,
  cabState,
}: {
  cabFormat: CabFormatType;
  cabState: CabStateType;
}) {
  const { uiOneHandleMasterControllerConfigs } = useSnapshot(store.data);

  const uiOptionId = cabFormat.oneHandleMasterControllerUIConfigId;
  const value = cabState.masterControllerValue;

  if (!uiOneHandleMasterControllerConfigs[uiOptionId]) return null;

  return (
    <MasterControllerSlider
      value={value}
      uiOneHandleMasterControllerConfig={uiOneHandleMasterControllerConfigs[uiOptionId] as UIOneHandleMasterControllerConfig}
      setValue={newValue =>
        send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
          [
            "trains",
            trainsState.activeTrainId,
            "cabStates",
            trainsState.activeBodyIndex - store.data.trains[trainsState.activeTrainId].bogies.length,
            "masterControllerValue"
          ],
          newValue
        ] as any)
      }
    />
  );
}