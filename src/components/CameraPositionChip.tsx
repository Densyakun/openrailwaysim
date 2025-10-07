import Chip from '@mui/material/Chip';
import { useSnapshot } from 'valtio';
import { cameraControlsState } from './cameras-and-controls/CameraControls';

export default function CameraPositionChip() {
  const { target } = useSnapshot(cameraControlsState);

  return (
    <Chip
      label={
        `${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)}`
      }
      size="small"
      sx={{
        backgroundColor: "#00000080"
      }}
    />
  );
}