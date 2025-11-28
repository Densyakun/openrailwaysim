import { Canvas } from '@react-three/fiber'
import Cameras from './cameras-and-controls/Cameras'
import CameraControls from './cameras-and-controls/CameraControls'
import SunAndSky from './SunAndSky'
import DreiSegments from './DreiSegments'
import FeatureCollections from './FeatureCollections'
import Tracks from './Tracks'
import Trains from './Trains'
import Terrains from './Terrains'
import TerrainGenerator from './TerrainGenerator'
import Client from './Client'
import { ErrorBoundary, FallbackProps, useErrorBoundary } from 'react-error-boundary'
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'

function ErrorFallback({ error }: FallbackProps) {
  const { resetBoundary } = useErrorBoundary();

  return (
    <Stack spacing={1} sx={{ position: "absolute", width: "100%", height: "100%", overflow: "scroll", zIndex: 1, backgroundColor: "#00000080", p: 1 }}>
      <Typography variant="h5" component="h1">Something went wrong:</Typography>
      <Alert severity="error">{(error as Error).name}: {(error as Error).message}</Alert>
      <Paper sx={{ p: 1, overflow: "auto", border: 1, backgroundColor: "black" }}>
        <pre style={{ color: "red" }}>{(error as Error).stack}</pre>
      </Paper>
      <Box>
        <Button variant="contained" onClick={resetBoundary}>Try again</Button>
      </Box>
    </Stack>
  );
}

export default function CanvasContainer() {
  return <ErrorBoundary
    FallbackComponent={ErrorFallback}
  >
    <Canvas shadows frameloop="demand" style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: '100%',
    }}>
      <Cameras />
      <CameraControls />
      <SunAndSky />
      <DreiSegments />
      <FeatureCollections />
      <Tracks />
      {/*<Trains />*/}
      <Terrains />
      <TerrainGenerator />
      <Client />
    </Canvas>
  </ErrorBoundary>;
}
