import { useState, useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Stack } from '@mui/material';
import { clientState, messageEmitter } from '@/lib/client/client';
import { useSnapshot } from 'valtio';
import { socket } from './Client';
import { MessageCode, send } from '@/lib/ws';
import { OnMessageInClient } from '@/lib/game';

export default function ConnectDialog() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  const { passwordRequired, isAuthenticated } = useSnapshot(clientState);

  useEffect(() => {
    if (passwordRequired && !isAuthenticated) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [passwordRequired, isAuthenticated]);

  const onAuthResult: OnMessageInClient = (code, value) => {
    if (code === MessageCode.FROM_SERVER_AUTH_RESULT) {
      if (value) {
        const name = username || "Anonymous";
        clientState.username = name;
        clientState.isAuthenticated = true;
        send(socket, MessageCode.FROM_CLIENT_SET_USERNAME, name);
        setOpen(false);
      }
      messageEmitter.off('message', onAuthResult);
    }
  };

  const handleConnect = () => {
    const name = username || "Anonymous";
    clientState.username = name;
    clientState.connectionPassword = password;

    messageEmitter.on('message', onAuthResult);
    send(socket, MessageCode.FROM_CLIENT_AUTH, password);
  };

  return (
    <Dialog open={open} onClose={() => {}} disableEscapeKeyDown>
      <DialogTitle>Connect to Server</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value.slice(0, 32))}
            fullWidth
            size="small"
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            fullWidth
            size="small"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleConnect} variant="contained">Connect</Button>
      </DialogActions>
    </Dialog>
  );
}
