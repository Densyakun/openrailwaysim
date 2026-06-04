import { useSnapshot } from 'valtio';
import { Button, Paper, Stack, Typography, TextField } from '@mui/material';
import { verticalCurveEditState } from '@/lib/client/verticalCurveEdit';
import { store } from '@/lib/game';
import { socket } from '../Client';
import { MessageCode, send } from '@/lib/ws';

export default function VerticalCurveEditor() {
  const { gradientPoints, trackIds } = useSnapshot(verticalCurveEditState, { sync: true });

  // Calculate total length
  let totalLength = 0;
  for (const trackId of trackIds) {
    const track = store.data.tracks[trackId];
    totalLength += track.length;
  }

  return <Paper sx={{
    p: 1,
    pointerEvents: 'auto',
    userSelect: 'none',
  }}>
    <Stack direction={'column'} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <div>Edit vertical curve (permil)</div>
        <Button variant='outlined' onClick={() => {
          verticalCurveEditState.isEditing = false;
          verticalCurveEditState.trackIds = [];
          verticalCurveEditState.gradientPoints = [];
        }}>
          Close
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2">Total length: {totalLength.toFixed(2)}m</Typography>
        <Typography variant="body2">Tracks: {trackIds.length}</Typography>
      </Stack>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1">
            Gradient points: {gradientPoints.length}
          </Typography>
          <Button variant='contained' size="small" onClick={() => {
            const newPosition = gradientPoints.length > 0 
              ? (parseFloat(gradientPoints[gradientPoints.length - 1].position) + totalLength / 10).toString()
              : "0";
            const newGradient = gradientPoints.length > 0
              ? gradientPoints[gradientPoints.length - 1].gradient
              : "0";
            verticalCurveEditState.gradientPoints = [...gradientPoints, { position: newPosition, gradient: newGradient }];
          }}>
            Add point
          </Button>
        </Stack>
        <Stack spacing={0.5}>
          {gradientPoints.map((point, index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ minWidth: 30 }}>{index + 1}</Typography>
              <TextField
                label="Position (m)"
                value={point.position}
                size="small"
                sx={{ width: 100 }}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  const newGradientPoints = gradientPoints.map((p, i) => 
                    i === index ? { ...p, position: event.target.value } : p
                  );
                  verticalCurveEditState.gradientPoints = newGradientPoints;
                }}
              />
              <TextField
                label="Gradient (‰)"
                value={point.gradient}
                size="small"
                sx={{ width: 100 }}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  const newGradientPoints = gradientPoints.map((p, i) => 
                    i === index ? { ...p, gradient: event.target.value } : p
                  );
                  verticalCurveEditState.gradientPoints = newGradientPoints;
                }}
              />
              <Button 
                variant="outlined"
                size="small"
                disabled={gradientPoints.length <= 2}
                onClick={() => {
                  const newGradientPoints = gradientPoints.filter((_, i) => i !== index);
                  verticalCurveEditState.gradientPoints = newGradientPoints;
                }}
              >
                Remove
              </Button>
            </Stack>
          ))}
        </Stack>
      </Stack>
      <Button 
        variant="contained" 
        disabled={gradientPoints.length < 2}
        onClick={() => {
          applyGradientsToTracks();
        }}
      >
        Apply to tracks
      </Button>
    </Stack>
  </Paper>;
}

function applyGradientsToTracks() {
  const { gradientPoints, trackIds } = verticalCurveEditState;
  
  // Sort gradient points by position
  const sortedPoints = gradientPoints
    .map(p => ({ position: parseFloat(p.position), gradient: parseFloat(p.gradient) }))
    .sort((a, b) => a.position - b.position);
  
  // Calculate total length
  let totalLength = 0;
  const trackLengths: number[] = [];
  for (const trackId of trackIds) {
    const track = store.data.tracks[trackId];
    trackLengths.push(track.length);
    totalLength += track.length;
  }

  // For each track, calculate its gradient points
  let currentLength = 0;
  for (let i = 0; i < trackIds.length; i++) {
    const trackId = trackIds[i];
    const trackLength = trackLengths[i];
    const trackStart = currentLength;
    const trackEnd = currentLength + trackLength;
    
    // Find gradient points that fall within this track
    const trackGradients: { [key: number]: number } = {};
    
    for (const point of sortedPoints) {
      if (point.position >= trackStart && point.position <= trackEnd) {
        const relativePosition = point.position - trackStart;
        trackGradients[relativePosition] = point.gradient;
      }
    }
    
    // Ensure we have at least the start and end points
    if (Object.keys(trackGradients).length === 0) {
      // Use the gradient from the nearest point
      const startGradient = getGradientAtPosition(sortedPoints, trackStart);
      trackGradients[0] = startGradient;
      trackGradients[trackLength] = startGradient;
    } else {
      // Ensure start point exists
      if (!trackGradients[0]) {
        trackGradients[0] = getGradientAtPosition(sortedPoints, trackStart);
      }
      // Ensure end point exists
      if (!trackGradients[trackLength]) {
        trackGradients[trackLength] = getGradientAtPosition(sortedPoints, trackEnd);
      }
    }
    
    // Apply to track
    send(socket, MessageCode.FROM_CLIENT_SET_PROP, [
      ["tracks", trackId, "gradients"],
      trackGradients
    ]);
    
    // Also update client-side immediately
    if (store.data.tracks[trackId]) {
      store.data.tracks[trackId].gradients = trackGradients;
    }
    
    currentLength += trackLength;
  }
}

function getGradientAtPosition(points: { position: number; gradient: number }[], position: number): number {
  if (points.length === 0) return 0;
  
  // Find the point at or before the position
  let beforePoint = points[0];
  let afterPoint = points[points.length - 1];
  
  for (const point of points) {
    if (point.position <= position) {
      beforePoint = point;
    }
    if (point.position >= position) {
      afterPoint = point;
      break;
    }
  }
  
  // If position is before the first point
  if (position < points[0].position) {
    return points[0].gradient;
  }
  
  // If position is after the last point
  if (position > points[points.length - 1].position) {
    return points[points.length - 1].gradient;
  }
  
  // Interpolate between before and after points
  if (beforePoint.position === afterPoint.position) {
    return beforePoint.gradient;
  }
  
  const t = (position - beforePoint.position) / (afterPoint.position - beforePoint.position);
  return beforePoint.gradient + t * (afterPoint.gradient - beforePoint.gradient);
}
