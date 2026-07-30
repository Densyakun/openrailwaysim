import * as React from 'react';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { proxy, subscribe } from 'valtio';
import { getDate } from '@/lib/client/client';
import { store } from '@/lib/game';
import { send } from '@/lib/ws';
import { MessageCode } from '@/lib/ws';
import { socket } from './Client';

const timeZones: { offset: number; name: string }[] = (() => {
  const zones: { offset: number; name: string }[] = [];
  for (let h = -12; h <= 14; h++) {
    const sign = h >= 0 ? '+' : '';
    const label = h === 0 ? 'GMT±0000' : `GMT${sign}${String(h * 100).padStart(4, '0')}`;
    zones.push({ offset: h * 60 * 60 * 1000, name: label });
  }
  return zones;
})();

export const state = proxy<{
  timeZoneOffset: number;
  timeZoneName: string;
}>({
  timeZoneOffset: 540 * 60 * 1000, // Default time zone is Asia/Tokyo
  timeZoneName: 'GMT+0900',
})

export default function TimeChip() {
  const [date, setDate] = React.useState(getDate(state.timeZoneOffset));
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editDate, setEditDate] = React.useState('');

  React.useEffect(() => subscribe(store.data, () => {
    const newDate = getDate(state.timeZoneOffset);

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

  const handleClick = () => {
    const d = getDate(state.timeZoneOffset);
    const y = d.getUTCFullYear();
    const mo = ("00" + (d.getUTCMonth() + 1)).slice(-2);
    const da = ("00" + d.getUTCDate()).slice(-2);
    const h = ("00" + d.getUTCHours()).slice(-2);
    const mi = ("00" + d.getUTCMinutes()).slice(-2);
    const s = ("00" + d.getUTCSeconds()).slice(-2);
    setEditDate(`${y}-${mo}-${da}T${h}:${mi}:${s}`);
    setDialogOpen(true);
  };

  const handleSetTime = () => {
    if (!editDate || !socket || socket.readyState !== 1) return;

    const [y, mo, d, h, mi, s = "0"] = editDate.split(/[-T:]/).map(Number);
    const newNowDate = Date.UTC(y, mo - 1, d, h, mi, s) - state.timeZoneOffset;

    send(socket, MessageCode.FROM_CLIENT_SET_TIME, newNowDate as any);

    store.data.nowDate = newNowDate;

    setDialogOpen(false);
  };

  const handleTimeJump = (deltaMs: number) => {
    if (!socket || socket.readyState !== 1) return;

    const newNowDate = store.data.nowDate + deltaMs;
    send(socket, MessageCode.FROM_CLIENT_SET_TIME, newNowDate as any);
    store.data.nowDate = newNowDate;
  };

  return (
    <>
      <Stack direction="row" spacing={0} alignItems="center">
        <IconButton
          onClick={() => handleTimeJump(-15 * 1000)}
          size="small"
          sx={{ pointerEvents: 'auto', p: 0, width: 24, height: 24, backgroundColor: "#00000080", borderRadius: "4px", "&:hover": { backgroundColor: "#000000A0" } }}
          title="15秒戻す"
        >
          <FastRewindIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Chip
          label={
            `${date.getUTCFullYear()}/${("00" + (date.getUTCMonth() + 1)).slice(-2)}/${("00" + date.getUTCDate()).slice(-2)} ${("00" + date.getUTCHours()).slice(-2)}:${("00" + date.getUTCMinutes()).slice(-2)}:${("00" + date.getUTCSeconds()).slice(-2)} ${state.timeZoneName}`
          }
          size="small"
          onClick={handleClick}
          sx={{
            pointerEvents: 'auto',
            backgroundColor: "#00000080",
            cursor: "pointer",
            "&:hover": {
              backgroundColor: "#000000A0",
            },
          }}
        />
        <IconButton
          onClick={() => handleTimeJump(15 * 1000)}
          size="small"
          sx={{ pointerEvents: 'auto', p: 0, width: 24, height: 24, backgroundColor: "#00000080", borderRadius: "4px", "&:hover": { backgroundColor: "#000000A0" } }}
          title="15秒進める"
        >
          <FastForwardIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>時刻を変更</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="日時"
              type="datetime-local"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              fullWidth
              inputProps={{ step: 1 }}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>タイムゾーン</InputLabel>
              <Select
                value={state.timeZoneOffset}
                label="タイムゾーン"
                onChange={(e) => {
                  const offset = e.target.value as number;
                  state.timeZoneOffset = offset;
                  const tz = timeZones.find(z => z.offset === offset);
                  if (tz) state.timeZoneName = tz.name;
                }}
              >
                {timeZones.map(tz => (
                  <MenuItem key={tz.offset} value={tz.offset}>{tz.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleSetTime} variant="contained">変更</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
