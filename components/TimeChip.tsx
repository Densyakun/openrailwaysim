import * as React from 'react';
import Chip from '@mui/material/Chip';
import { subscribe } from 'valtio';
import { gameState } from '@/lib/client';

export default function TimeChip() {
  const [date, setDate] = React.useState(new Date(gameState.nowDate));

  React.useEffect(() => subscribe(gameState, () => {
    const newDate = new Date(gameState.nowDate);

    if (!(
      date.getUTCSeconds() === newDate.getUTCSeconds()
      && date.getUTCMinutes() === newDate.getUTCMinutes()
      && date.getUTCHours() === newDate.getUTCHours()
      && date.getUTCDate() === newDate.getUTCDate()
      && date.getUTCMonth() === newDate.getUTCMonth()
      && date.getUTCFullYear() === newDate.getUTCFullYear()
    ))
      setDate(newDate);
  }), [date]);

  return (
    <Chip
      label={
        `${date.getUTCFullYear()}/${("00" + (date.getUTCMonth() + 1)).slice(-2)}/${("00" + date.getUTCDate()).slice(-2)} ${("00" + date.getUTCHours()).slice(-2)}:${("00" + date.getUTCMinutes()).slice(-2)}:${("00" + date.getUTCSeconds()).slice(-2)} GMT`
      }
      size="small"
      sx={{
        backgroundColor: "#00000080"
      }}
    />
  );
}