import Chip from '@mui/material/Chip';
import { useSnapshot } from 'valtio';
import { clientState } from '@/lib/client/client';

export default function ConnectionChip() {
  const { readyState, isSynced } = useSnapshot(clientState)

  return (
    <Chip
      label={
        readyState === WebSocket.OPEN
          ? isSynced ? "Synced" : "Not synced"
          : ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][readyState]
      }
      size="small"
      sx={{
        backgroundColor: readyState === WebSocket.OPEN && isSynced ? "#00000080" : "#ff000080"
      }}
    />
  );
}