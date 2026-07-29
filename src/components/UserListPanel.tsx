import { useSnapshot } from 'valtio';
import { clientState } from '@/lib/client/client';
import { Paper, Stack, Typography, Chip } from '@mui/material';

export default function UserListPanel() {
  const { users, username } = useSnapshot(clientState);

  return (
    <Paper square sx={{
      width: "100%",
      height: "100%",
      pointerEvents: 'auto',
      userSelect: 'none',
      p: 1,
      overflow: 'auto',
      backgroundColor: '#000b',
    }}>
      <Typography variant="h5" component="h1" sx={{ mb: 1 }}>Connected Users ({users.length})</Typography>
      <Stack spacing={0.5}>
        {users.map(user => (
          <Chip
            key={user.id}
            label={`${user.username}${user.username === username ? " (you)" : ""}`}
            size="small"
            variant={user.username === username ? "filled" : "outlined"}
            color={user.username === username ? "primary" : "default"}
          />
        ))}
        {users.length === 0 && (
          <Typography variant="body2" color="text.secondary">No users connected</Typography>
        )}
      </Stack>
    </Paper>
  );
}
