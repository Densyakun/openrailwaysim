import * as React from 'react';
import { Box, Paper, Slider, SxProps } from '@mui/material';
import { useSnapshot } from 'valtio';
import { state as trainsState } from '@/lib/trains';
import { gameState } from '@/lib/client';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element;

export default function MasterController() {
  useSnapshot(gameState);
  useSnapshot(trainsState);

  const train = gameState.trains[trainsState.activeTrainId];
  const { masterControllers } = trainsState.activeBobyIndex < train.bogies.length ? train.bogies[trainsState.activeBobyIndex] : train.otherBodies[trainsState.activeBobyIndex - train.bogies.length];
  // TODO 複数のマスコンの追加されたボギー台車に対応する
  const masterController = masterControllers[0];
  if (!masterController) return null;

  const { uiOptionId, value } = masterController;
  const { marks, maxValue, nValue, stepRangeList, steps } = gameState.uiOneHandleMasterControllerConfigs[uiOptionId];

  const handleChange = (event: Event, newValue: number | number[]) => {
    const newValue_ = newValue as number;
    for (const stepRange of stepRangeList) {
      if (stepRange[0] <= newValue_ && newValue_ <= stepRange[1]) {
        for (let stepIndex = 0; stepIndex <= steps.length - 2; stepIndex++) {
          if (steps[stepIndex] <= newValue_ && newValue_ <= steps[stepIndex + 1]) {
            masterController.value = newValue_ < steps[stepIndex] + (steps[stepIndex + 1] - steps[stepIndex]) / 2
              ? steps[stepIndex]
              : steps[stepIndex + 1];
            return;
          }
        }
      }
    };

    masterController.value = newValue_;
  };

  const trackColor = value < nValue ? "#00ff00" : "#ffff00"

  return (
    <Box_ sx={{
      position: "relative",
      display: "contents",
    }}>
      <Paper sx={{
        position: "absolute",
        left: 0,
        height: "67%",
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
      <Box_ sx={{
        position: "absolute",
        left: 0,
        height: "67%",
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
      </Box_>
    </Box_>
  );
}