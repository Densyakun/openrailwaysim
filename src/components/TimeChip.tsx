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
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import { proxy, subscribe } from 'valtio';
import { getDate } from '@/lib/client/client';
import { store } from '@/lib/game';
import { send } from '@/lib/ws';
import { MessageCode } from '@/lib/ws';
import { socket } from './Client';

export const state = proxy<{
  timeZoneOffset: number;
  timeZoneName: string;
}>({
  timeZoneOffset: 540 * 60 * 1000, // Default time zone is Asia/Tokyo
  timeZoneName: 'GMT+0900 (日本標準時)',
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
    // 現在の時刻をdatetime-local形式に変換
    const y = date.getUTCFullYear();
    const mo = ("00" + (date.getUTCMonth() + 1)).slice(-2);
    const d = ("00" + date.getUTCDate()).slice(-2);
    const h = ("00" + date.getUTCHours()).slice(-2);
    const mi = ("00" + date.getUTCMinutes()).slice(-2);
    setEditDate(`${y}-${mo}-${d}T${h}:${mi}`);
    setDialogOpen(true);
  };

  const handleSetTime = () => {
    if (!editDate || !socket || socket.readyState !== 1) return;

    // 入力された時刻をUTCエポックミリ秒に変換（タイムゾーンオフセットを考慮）
    const localDate = new Date(editDate);
    const newNowDate = localDate.getTime() - state.timeZoneOffset;

    // サーバーに時刻変更メッセージを送信
    send(socket, MessageCode.FROM_CLIENT_SET_TIME, newNowDate as any);

    // クライアント側の時刻も即座に更新
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
      <Chip
        label={
          `${date.getUTCFullYear()}/${("00" + (date.getUTCMonth() + 1)).slice(-2)}/${("00" + date.getUTCDate()).slice(-2)} ${("00" + date.getUTCHours()).slice(-2)}:${("00" + date.getUTCMinutes()).slice(-2)}:${("00" + date.getUTCSeconds()).slice(-2)} ${state.timeZoneName}`
        }
        size="small"
        onClick={handleClick}
        sx={{
          backgroundColor: "#00000080",
          cursor: "pointer",
          "&:hover": {
            backgroundColor: "#000000A0",
          },
        }}
      />
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
              InputLabelProps={{ shrink: true }}
            />
            <Stack direction="row" spacing={1} justifyContent="center">
              <IconButton onClick={() => handleTimeJump(-12 * 60 * 60 * 1000)} title="12時間前">
                <FastRewindIcon />
              </IconButton>
              <IconButton onClick={() => handleTimeJump(-60 * 60 * 1000)} title="1時間前">
                <SkipPreviousIcon />
              </IconButton>
              <IconButton onClick={() => handleTimeJump(60 * 60 * 1000)} title="1時間後">
                <SkipNextIcon />
              </IconButton>
              <IconButton onClick={() => handleTimeJump(12 * 60 * 60 * 1000)} title="12時間後">
                <FastForwardIcon />
              </IconButton>
            </Stack>
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
