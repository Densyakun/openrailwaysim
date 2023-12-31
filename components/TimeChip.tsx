import * as React from 'react';
import Chip from '@mui/material/Chip';
import { proxy, subscribe } from 'valtio';
import { gameState } from '@/lib/client';

export const state = proxy<{
  timeZoneOffset: number;
  timeZoneName: string;
}>({
  timeZoneOffset: 540 * 60 * 1000, // Default time zone is Asia/Tokyo
  timeZoneName: 'GMT+0900 (日本標準時)',
})

export default function TimeChip() {
  const [date, setDate] = React.useState(new Date(gameState.nowDate + state.timeZoneOffset));

  React.useEffect(() => subscribe(gameState, () => {
    const newDate = new Date(gameState.nowDate + state.timeZoneOffset);

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
        `${date.getUTCFullYear()}/${("00" + (date.getUTCMonth() + 1)).slice(-2)}/${("00" + date.getUTCDate()).slice(-2)} ${("00" + date.getUTCHours()).slice(-2)}:${("00" + date.getUTCMinutes()).slice(-2)}:${("00" + date.getUTCSeconds()).slice(-2)} ${state.timeZoneName}`
      }
      size="small"
      sx={{
        backgroundColor: "#00000080"
      }}
    />
  );
}