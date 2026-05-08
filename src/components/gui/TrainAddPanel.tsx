import * as React from 'react';
import { useSnapshot } from 'valtio';
import {
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  Box,
  Autocomplete,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import NavigationIcon from '@mui/icons-material/Navigation';
import { resetEditingTrainState, trainsTabPanelState } from '@/lib/client/trains';
import { store } from '@/lib/game';
import { placeTrain } from '@/lib/trains';
import { MessageCode, send } from '@/lib/ws';
import { socket } from '../Client';

export default function TrainAddPanel() {
  const panelState = useSnapshot(trainsTabPanelState);
  const { trainFormats, trains, trainGroups } = useSnapshot(store.data);

  const [trainIdInput, setTrainIdInput] = React.useState(panelState.newTrainId || '');
  const [formatId, setFormatId] = React.useState(panelState.trainFormatId || '');
  
  const [selectedGroup, setSelectedGroup] = React.useState(() => {
    if (panelState.selectedTrainGroup) return panelState.selectedTrainGroup;
    const groups = Object.keys(store.data.trainGroups);
    return groups.length > 0 ? groups[0] : 'default';
  });
  
  const [directionReversed, setDirectionReversed] = React.useState(panelState.directionIsReversed || false);

  // 同期用
  React.useEffect(() => {
    trainsTabPanelState.newTrainId = trainIdInput;
  }, [trainIdInput]);

  React.useEffect(() => {
    trainsTabPanelState.trainFormatId = formatId;
  }, [formatId]);

  React.useEffect(() => {
    trainsTabPanelState.selectedTrainGroup = selectedGroup;
  }, [selectedGroup]);

  React.useEffect(() => {
    trainsTabPanelState.directionIsReversed = directionReversed;
  }, [directionReversed]);

  // panelState変更検知によるローカルステート同期
  React.useEffect(() => {
    if (panelState.newTrainId !== trainIdInput) {
      setTrainIdInput(panelState.newTrainId);
    }
  }, [panelState.newTrainId]);

  React.useEffect(() => {
    if (panelState.trainFormatId !== formatId) {
      setFormatId(panelState.trainFormatId);
    }
  }, [panelState.trainFormatId]);

  // ID重複チェック
  const isDuplicateId = React.useMemo(() => {
    return !!trains[trainIdInput] || trainIdInput === 'preview';
  }, [trains, trainIdInput]);

  const isValidId = React.useMemo(() => {
    return trainIdInput.trim().length > 0 && /^[a-zA-Z0-9_-]+$/.test(trainIdInput);
  }, [trainIdInput]);

  const canPlace = React.useMemo(() => {
    return isValidId && !isDuplicateId && !!formatId && !!panelState.pointOnTrack && !!selectedGroup.trim();
  }, [isValidId, isDuplicateId, formatId, panelState.pointOnTrack, selectedGroup]);

  const handlePlace = () => {
    const groupToUse = selectedGroup.trim();
    if (!canPlace || !panelState.pointOnTrack || !groupToUse) return;

    const targetFormat = store.data.trainFormats[formatId];
    if (!targetFormat) return;

    const rawPoint = trainsTabPanelState.pointOnTrack;
    if (!rawPoint) return;

    try {
      const { train, isDeadEnd } = placeTrain(
        targetFormat,
        { trackId: rawPoint.trackId, length: rawPoint.length },
        directionReversed
      );

      if (train) {
        train.trainFormatId = formatId;

        const currentGroupTrains = store.data.trainGroups[groupToUse] || [];
        const newGroupTrains = [...currentGroupTrains, trainIdInput];

        send(socket, MessageCode.FROM_CLIENT_MESSAGES, [
          [MessageCode.FROM_CLIENT_SET_PROP, [["trains", trainIdInput], train]],
          [MessageCode.FROM_CLIENT_SET_PROP, [["trainGroups", groupToUse], newGroupTrains]]
        ]);

        resetEditingTrainState();
      }
    } catch (e) {
      console.error("Failed to place train:", e);
    }
  };

  const handleCancel = () => {
    resetEditingTrainState();
  };

  return (
    <Paper
      square
      sx={{
        width: 400,
        maxHeight: "100%",
        pointerEvents: 'auto',
        userSelect: 'none',
        p: 2,
        overflow: 'auto',
        backgroundColor: '#000b',
        backdropFilter: 'blur(10px)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={handleCancel}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.5)',
                backgroundColor: 'rgba(255,255,255,0.05)',
              }
            }}
          >
            Cancel
          </Button>
          <Typography variant="h6" component="div" sx={{ color: '#fff', fontWeight: 600, flexGrow: 1, ml: 1 }}>
            Add Train
          </Typography>
        </Stack>

        <TextField
          label="Train ID"
          variant="outlined"
          fullWidth
          value={trainIdInput}
          onChange={(e) => setTrainIdInput(e.target.value)}
          error={isDuplicateId || (trainIdInput.trim().length > 0 && !isValidId)}
          helperText={
            isDuplicateId
              ? "This ID is already in use."
              : (trainIdInput.trim().length > 0 && !isValidId)
              ? "Only alphanumeric characters, dashes, and underscores are allowed."
              : "Enter a unique ID for this train."
          }
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
            '& .MuiInputBase-input': { color: '#fff' },
            '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.5)' }
          }}
        />

        <Autocomplete
          freeSolo
          options={Object.keys(trainGroups)}
          value={selectedGroup}
          onChange={(event, newValue) => {
            setSelectedGroup(newValue || '');
          }}
          onInputChange={(event, newInputValue) => {
            setSelectedGroup(newInputValue || '');
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Train Group"
              variant="outlined"
              helperText={
                selectedGroup.trim().length > 0 && !trainGroups[selectedGroup.trim()]
                  ? "This is a new group and will be created automatically."
                  : "Select an existing group or type to create a new one."
              }
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.5)' }
              }}
            />
          )}
        />

        <FormControl fullWidth sx={{
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
          },
          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
          '& .MuiSelect-select': { color: '#fff' }
        }}>
          <InputLabel id="train-format-select-label">Train Format</InputLabel>
          <Select
            labelId="train-format-select-label"
            value={formatId}
            label="Train Format"
            onChange={(e) => setFormatId(e.target.value)}
          >
            {Object.keys(trainFormats).map((id) => (
              <MenuItem key={id} value={id}>
                {id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{
          p: 2,
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(255,255,255,0.02)'
        }}>
          <FormControlLabel
            control={
              <Switch
                checked={directionReversed}
                onChange={(e) => setDirectionReversed(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                  Reverse Direction
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  Flip train orientation on track
                </Typography>
              </Box>
            }
          />
        </Box>

        <Card sx={{
          backgroundColor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 1,
        }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1, display: 'flex', alignItems: 'center' }}>
              <NavigationIcon sx={{ fontSize: 16, mr: 0.5, transform: 'rotate(45deg)' }} />
              Placement Position
            </Typography>

            {panelState.pointOnTrack ? (
              <Box>
                <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 600 }}>
                  ✓ Position Selected
                </Typography>
                <Box sx={{ mt: 1, pl: 1, borderLeft: '2px solid #10b981' }}>
                  <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Track ID: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{panelState.pointOnTrack.trackId}</span>
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Length: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{panelState.pointOnTrack.length.toFixed(3)} m</span>
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 1.5 }}>
                  Click another track in the viewport to change position.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ py: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#f59e0b',
                    fontWeight: 500,
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.6 },
                      '50%': { opacity: 1 },
                    }
                  }}
                >
                  ⚠ Click on a track in the viewport to place
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 1 }}>
                  Move your mouse over a track (it will glow yellow) and click to lock the placement point. You'll see a green preview train.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<AddIcon />}
          disabled={!canPlace}
          onClick={handlePlace}
          sx={{
            py: 1.5,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '1rem',
            backgroundColor: canPlace ? '#10b981' : 'rgba(255,255,255,0.1)',
            '&:hover': {
              backgroundColor: '#059669',
            },
            '&.Mui-disabled': {
              color: 'rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.05)',
            }
          }}
        >
          Place Train
        </Button>
      </Stack>
    </Paper>
  );
}
