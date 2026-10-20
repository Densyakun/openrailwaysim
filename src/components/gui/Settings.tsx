import { useState, useEffect } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CameraSwitch from '../cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from '../cameras-and-controls/CameraControlsSwitch';
import { Button, Paper, Stack, TextField, Typography, Chip, Box, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemButton, ListItemText, IconButton, Tooltip, Switch, FormControlLabel, Slider } from '@mui/material';
import { socket } from '../Client';
import { SERVER_URL_STORAGE_KEY } from '@/lib/client/client';
import CameraFarTextField from '../cameras-and-controls/CameraFarTextField';
import { MessageCode, send } from '@/lib/ws';
import { clientState, getDefaultServerUrl } from '@/lib/client/client';
import { useSnapshot } from 'valtio';

export default function Settings() {
  const [adminPassword, setAdminPassword] = useState("");
  const [saveName, setSaveName] = useState("");
  const [loadName, setLoadName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saveListExpanded, setSaveListExpanded] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState("");
  const { isAdmin, adminPasswordRequired, saves, currentSave, serverUrl, localMode, enableBloom, bloomStrength, bloomRadius, bloomThreshold } = useSnapshot(clientState);

  useEffect(() => {
    if (isAdmin) {
      send(socket, MessageCode.FROM_CLIENT_LIST_SAVES);
    }
  }, [isAdmin]);

  // サーバーURLをローカル入力に同期する
  useEffect(() => {
    setServerUrlInput(serverUrl);
  }, [serverUrl]);

  // サーバーURLを確定して再接続する
  const commitServerUrl = () => {
    const url = serverUrlInput.trim();
    clientState.serverUrl = url;
    if (url) localStorage.setItem(SERVER_URL_STORAGE_KEY, url);
    else localStorage.removeItem(SERVER_URL_STORAGE_KEY);
  };

  const handleAdminLogin = () => {
    send(socket, MessageCode.FROM_CLIENT_ADMIN_AUTH, adminPassword);
    setAdminPassword("");
  };

  const handleAdminLogout = () => {
    clientState.isAdmin = false;
  };

  const handleListSaves = () => {
    send(socket, MessageCode.FROM_CLIENT_LIST_SAVES);
  };

  const handleSave = () => {
    if (saveName) {
      send(socket, MessageCode.FROM_CLIENT_SAVE, saveName);
      clientState.currentSave = saveName;
      send(socket, MessageCode.FROM_CLIENT_LIST_SAVES);
    }
  };

  const handleLoad = () => {
    if (loadName) {
      send(socket, MessageCode.FROM_CLIENT_LOAD_SAVE, loadName);
      clientState.currentSave = loadName;
    }
  };

  const handleDelete = (name: string) => {
    setDeleteConfirm(name);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      send(socket, MessageCode.FROM_CLIENT_DELETE_SAVE, deleteConfirm);
      setDeleteConfirm(null);
      send(socket, MessageCode.FROM_CLIENT_LIST_SAVES);
    }
  };

  return <Paper square sx={{
    width: "min(520px, 90vw)",
    maxHeight: 'calc(100vh - 140px)',
    pointerEvents: 'auto',
    userSelect: 'none',
    p: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#000b',
    boxSizing: 'border-box',
  }}>
    <Stack spacing={1}>
      <Typography variant="h5" component="h1">Connection</Typography>
      <TextField
        label="Username"
        size="small"
        defaultValue={clientState.username}
        onBlur={e => {
          const name = e.target.value.slice(0, 32) || "Anonymous";
          clientState.username = name;
          if (socket && clientState.isAuthenticated) {
            send(socket, MessageCode.FROM_CLIENT_SET_USERNAME, name);
          }
        }}
      />
      {localMode ? (
        <Chip label="Local mode (no WebSocket server)" color="info" size="small" />
      ) : (
        <TextField
          label="Server URL"
          size="small"
          placeholder={getDefaultServerUrl()}
          value={serverUrlInput}
          helperText="空欄の場合はこのページのホストに接続します。確定すると再接続します。"
          onChange={e => setServerUrlInput(e.target.value)}
          onBlur={commitServerUrl}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitServerUrl();
            }
          }}
        />
      )}
      <Typography variant="h5" component="h1">Camera settings</Typography>
      <CameraSwitch />
      <CameraFarTextField />
      <Typography variant="h5" component="h1">Controls settings</Typography>
      <CameraControlsSwitch />

      <Typography variant="h5" component="h1">Graphics</Typography>
      <FormControlLabel
        control={<Switch checked={enableBloom} onChange={e => { clientState.enableBloom = e.target.checked; }} />}
        label="Bloom"
      />
      {enableBloom && <>
        <Typography variant="body2">Strength: {bloomStrength.toFixed(2)}</Typography>
        <Slider size="small" min={0} max={2} step={0.05} value={bloomStrength}
          onChange={(_e, v) => { clientState.bloomStrength = v as number; }} />
        <Typography variant="body2">Radius: {bloomRadius.toFixed(2)}</Typography>
        <Slider size="small" min={0} max={1} step={0.05} value={bloomRadius}
          onChange={(_e, v) => { clientState.bloomRadius = v as number; }} />
        <Typography variant="body2">Threshold: {bloomThreshold.toFixed(2)}</Typography>
        <Slider size="small" min={0} max={1} step={0.01} value={bloomThreshold}
          onChange={(_e, v) => { clientState.bloomThreshold = v as number; }} />
      </>}

      <Typography variant="h5" component="h1" sx={{ mt: 1 }}>Admin</Typography>
      {!isAdmin ? (
        adminPasswordRequired ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Admin Password"
              type="password"
              size="small"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdminLogin();
                }
              }}
              sx={{ flexGrow: 1 }}
            />
            <Button variant="contained" startIcon={<AdminPanelSettingsIcon />} onClick={handleAdminLogin}>
              Login
            </Button>
          </Stack>
        ) : (
          <Chip label="Admin mode (no password)" color="success" size="small" />
        )
      ) : adminPasswordRequired ? (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label="Admin mode" color="success" size="small" />
            <Button variant="outlined" size="small" startIcon={<LogoutIcon />} onClick={handleAdminLogout}>
              Logout
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Chip label="Admin mode (no password)" color="success" size="small" />
      )}

      {isAdmin && <>
        <Typography variant="h5" component="h1">Save Data</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Save name"
            size="small"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            sx={{ flexGrow: 1 }}
            disabled={!isAdmin}
          />
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!isAdmin || !saveName}>
            Save
          </Button>
        </Stack>
        {currentSave && (
          <Typography variant="body2" color="text.secondary">
            Current save: {currentSave}
          </Typography>
        )}
        <Accordion expanded={saveListExpanded} onChange={(_, v) => setSaveListExpanded(v)} disableGutters sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.04)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />} sx={{ color: 'white' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2">セーブデータ一覧 ({saves.length})</Typography>
              {loadName && (
                <Chip label={`選択: ${loadName}`} size="small" color="primary" sx={{ ml: 1 }} />
              )}
            </Stack>
            <Tooltip title="更新">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleListSaves(); }} disabled={!isAdmin} sx={{ color: 'white', mr: 1 }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {saves.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>セーブデータがありません</Typography>
            ) : (
              <List dense disablePadding sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {saves.map(name => {
                  const isSelected = loadName === name;
                  const isCurrent = currentSave === name;
                  return (
                    <ListItem key={name} disablePadding secondaryAction={
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="読み込む">
                          <IconButton edge="end" size="small" onClick={() => { setLoadName(name); send(socket, MessageCode.FROM_CLIENT_LOAD_SAVE, name); clientState.currentSave = name; }} disabled={!isAdmin} sx={{ color: isSelected ? 'primary.main' : 'white' }}>
                            <FolderOpenIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="削除">
                          <IconButton edge="end" size="small" onClick={() => handleDelete(name)} disabled={!isAdmin} sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    }>
                      <ListItemButton selected={isSelected} onClick={() => setLoadName(name)} sx={{ color: 'white', '&.Mui-selected': { bgcolor: 'rgba(25,118,210,0.24)' }, '&.Mui-selected:hover': { bgcolor: 'rgba(25,118,210,0.32)' } }}>
                        <ListItemText primary={name} secondary={isCurrent ? 'current' : undefined} primaryTypographyProps={{ variant: 'body2', noWrap: true }} secondaryTypographyProps={{ variant: 'caption' }} />
                        {isCurrent && <Chip label="current" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
            <Stack direction="row" spacing={1} sx={{ p: 1, justifyContent: 'flex-end' }}>
              <Button size="small" variant="outlined" startIcon={<FolderOpenIcon />} onClick={handleLoad} disabled={!isAdmin || !loadName}>
                選択を読み込む
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>
      </>}
    </Stack>
    <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
      <DialogTitle>Delete save</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete "{deleteConfirm}"? This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
        <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
      </DialogActions>
    </Dialog>
  </Paper>;
}