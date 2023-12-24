import * as React from 'react';
import Chip from '@mui/material/Chip';
import { useSnapshot } from 'valtio';
import { clientState } from '@/lib/client';

export default function SyncedChip() {
  const { isSynced } = useSnapshot(clientState)

  return (
    <Chip
      label={
        `isSynced: ${isSynced ? "true" : "false"}`
      }
      size="small"
      sx={{
        backgroundColor: "#00000080"
      }}
    />
  );
}