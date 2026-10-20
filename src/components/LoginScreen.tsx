import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { clientState, getDefaultServerUrl, SERVER_URL_STORAGE_KEY } from '@/lib/client/client';
import { useSnapshot } from 'valtio';

function getInitialServerUrl() {
  try {
    return localStorage.getItem(SERVER_URL_STORAGE_KEY) || getDefaultServerUrl();
  } catch {
    return getDefaultServerUrl();
  }
}

function isValidServerUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "ws:" || url.protocol === "wss:";
  } catch {
    return false;
  }
}

export default function LoginScreen() {
  const { loginOpen, loginStatus, loginError, serverUrl } = useSnapshot(clientState);
  const [serverUrlInput, setServerUrlInput] = useState(getInitialServerUrl);
  const [username, setUsername] = useState(clientState.username);
  const [password, setPassword] = useState("");

  const connecting = loginStatus === "connecting" || loginStatus === "authenticating";

  useEffect(() => {
    if (!loginOpen) return;
    setServerUrlInput(serverUrl || getInitialServerUrl());
  }, [loginOpen, serverUrl]);

  if (!loginOpen) return null;

  const handleConnect = (event: FormEvent) => {
    event.preventDefault();
    if (connecting) return;

    const url = serverUrlInput.trim() || getDefaultServerUrl();
    const name = username.trim() || "Anonymous";

    if (!isValidServerUrl(url)) {
      clientState.loginStatus = "failed";
      clientState.loginError = "WebSocket の URL（ws:// または wss://）を入力してください。";
      return;
    }

    try {
      localStorage.setItem(SERVER_URL_STORAGE_KEY, url);
    } catch {
      // localStorage が使えない場合でも接続は継続する
    }

    clientState.serverUrl = url;
    clientState.username = name;
    clientState.connectionPassword = password;
    clientState.localMode = false;
    clientState.isStarted = true;
    clientState.loginOpen = true;
    clientState.loginStatus = "connecting";
    clientState.loginError = "";
    clientState.connectionAttempt++;
  };

  const handleLocalMode = () => {
    const name = username.trim() || "Anonymous";

    clientState.username = name;
    clientState.connectionPassword = "";
    clientState.localMode = true;
    clientState.isStarted = true;
    clientState.loginOpen = false;
    clientState.loginStatus = "connected";
    clientState.loginError = "";
    clientState.connectionAttempt++;
  };

  return (
    <Box sx={{
      position: 'fixed',
      inset: 0,
      zIndex: theme => theme.zIndex.modal + 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000c',
      backdropFilter: 'blur(4px)',
    }}>
      <Paper
        component="form"
        onSubmit={handleConnect}
        sx={{
          width: 'min(440px, 90vw)',
          p: 3,
          backgroundColor: '#111d',
          pointerEvents: 'auto',
        }}
      >
        <Typography variant="h4" component="h1">Open Railway Sim</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          接続する WebSocket サーバーを入力してください。
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Server URL"
            size="small"
            fullWidth
            autoFocus
            value={serverUrlInput}
            onChange={e => setServerUrlInput(e.target.value)}
            placeholder={getDefaultServerUrl()}
            helperText="空欄の場合はこのページのホストに接続します。"
          />
          <TextField
            label="Username"
            size="small"
            fullWidth
            value={username}
            onChange={e => setUsername(e.target.value.slice(0, 32))}
            placeholder="Anonymous"
          />
          <TextField
            label="Password"
            type="password"
            size="small"
            fullWidth
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {loginError && <Alert severity="error">{loginError}</Alert>}
          <Button type="submit" variant="contained" disabled={connecting}>
            {connecting ? "接続中..." : "サーバーに接続"}
          </Button>
          <Button variant="outlined" onClick={handleLocalMode} disabled={connecting}>
            ローカルモードで開始
          </Button>
          <Typography variant="caption" color="text.secondary">
            ローカルモードでは WebSocket サーバーを使わず、セーブデータはブラウザ内に保存されます。
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
