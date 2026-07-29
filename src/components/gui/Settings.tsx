import { useState, useEffect } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import CameraSwitch from '../cameras-and-controls/CameraSwitch';
import CameraControlsSwitch from '../cameras-and-controls/CameraControlsSwitch';
import { Button, Paper, Stack, TextField, Typography, Chip, Select, MenuItem, FormControl, InputLabel, Box, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { socket } from '../Client';
import CameraFarTextField from '../cameras-and-controls/CameraFarTextField';
import { MessageCode, send } from '@/lib/ws';
import { clientState } from '@/lib/client/client';
import { useSnapshot } from 'valtio';

export default function Settings() {
  const [adminPassword, setAdminPassword] = useState("");
  const [saveName, setSaveName] = useState("");
  const [loadName, setLoadName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { isAdmin, adminPasswordRequired, saves, currentSave } = useSnapshot(clientState);

  useEffect(() => {
    if (isAdmin) {
      send(socket, MessageCode.FROM_CLIENT_LIST_SAVES);
    }
  }, [isAdmin]);

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
    width: "100%",
    height: "100%",
    pointerEvents: 'auto',
    userSelect: 'none',
    p: 1,
    overflow: 'auto',
    backgroundColor: '#000b',
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
      <Typography variant="h5" component="h1">Camera settings</Typography>
      <CameraSwitch />
      <CameraFarTextField />
      <Typography variant="h5" component="h1">Controls settings</Typography>
      <CameraControlsSwitch />

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
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControl size="small" sx={{ flexGrow: 1 }}>
          <InputLabel>Load save</InputLabel>
          <Select
            value={loadName}
            label="Load save"
            onChange={e => setLoadName(e.target.value)}
            disabled={!isAdmin}
          >
            {saves.map(name => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="outlined" startIcon={<FolderOpenIcon />} onClick={handleLoad} disabled={!isAdmin || !loadName}>
          Load
        </Button>
        <Button variant="outlined" onClick={handleListSaves} disabled={!isAdmin}>
          <RefreshIcon />
        </Button>
      </Stack>
      {currentSave && (
        <Typography variant="body2" color="text.secondary">
          Current save: {currentSave}
        </Typography>
      )}
      {saves.length > 0 && (
        <Box>
          <Typography variant="subtitle2">Available saves:</Typography>
          {saves.map(name => (
            <Stack key={name} direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Chip label={name} size="small" variant="outlined" />
              <Button
                size="small"
                color="error"
                onClick={() => handleDelete(name)}
                disabled={!isAdmin}
              >
                <DeleteIcon fontSize="small" />
              </Button>
            </Stack>
          ))}
        </Box>
      )}
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