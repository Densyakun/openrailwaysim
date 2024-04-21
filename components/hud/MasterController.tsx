import * as React from 'react';
import { Box, Paper, Slider, SxProps } from '@mui/material';
import { useSnapshot } from 'valtio';
import { UIOneHandleMasterControllerConfig, state as trainsState } from '@/lib/trains';
import { gameState } from '@/lib/client';
import { socket } from '../Client';
import { FROM_CLIENT_MASTER_CONTOLLER_CHANGE_STATE } from '@/lib/game';

const Box_ = Box as (props: {
  children?: React.ReactNode;
  component?: React.ElementType;
  ref?: React.Ref<unknown>;
  sx?: SxProps;
}) => JSX.Element;

export function MasterControllerSlider({ value, uiOneHandleMasterControllerConfig, setValue }: { value: number, uiOneHandleMasterControllerConfig: UIOneHandleMasterControllerConfig, setValue: (newValue: number) => void }) {
  const { marks, maxValue, nValue, stepRangeList, steps } = uiOneHandleMasterControllerConfig;

  const handleChange = (event: Event, newValue: number | number[]) => {
    const newValue_ = newValue as number;

    const getNewValue = (newValue: number) => {
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
    <Box_ sx={{
      width: "90px",
      height: "320px",
    }}>
      <Box_ sx={{
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
        <Box_ sx={{
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
        </Box_>
      </Box_>
    </Box_>
  );
}

export default function MasterController() {
  useSnapshot(gameState);
  useSnapshot(trainsState);

  const train = gameState.trains[trainsState.activeTrainId];
  const { masterControllers } = trainsState.activeBodyIndex < train.bogies.length ? train.bogies[trainsState.activeBodyIndex] : train.otherBodies[trainsState.activeBodyIndex - train.bogies.length];
  // TODO 複数のマスコンの追加されたボギー台車に対応する
  const masterControllerIndex = 0;
  const masterController = masterControllers[masterControllerIndex];
  if (!masterController) return null;

  const { uiOptionId, value } = masterController;

  return (
    <MasterControllerSlider
      value={value}
      uiOneHandleMasterControllerConfig={gameState.uiOneHandleMasterControllerConfigs[uiOptionId]}
      setValue={newValue =>
        socket.send(JSON.stringify([FROM_CLIENT_MASTER_CONTOLLER_CHANGE_STATE, [
          trainsState.activeTrainId,
          trainsState.activeBodyIndex,
          masterControllerIndex,
          newValue
        ]]))
      }
    />
  );
}