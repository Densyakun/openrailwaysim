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
import { ErrorBoundary } from 'react-error-boundary'
import { useSnapshot } from 'valtio'
import { trainsTabPanelState } from '@/lib/client/trains'
import { guiState } from '@/lib/client/gui'
import TrainFormatPreview from './TrainFormatPreview'
import { TrainFormat } from '@/lib/trains'
import ErrorFallback from './ErrorFallback'

export default function CanvasContainer() {
  const { editingTrainFormat } = useSnapshot(trainsTabPanelState);
  const { selectedTab } = useSnapshot(guiState);

  const isPreviewMode = !!editingTrainFormat && selectedTab === "trains";

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
      <Client />
      {isPreviewMode ? (
        <TrainFormatPreview format={editingTrainFormat as TrainFormat} />
      ) : (
        <>
          <DreiSegments />
          <FeatureCollections />
          <Tracks />
          <Trains />
          <Terrains />
          <TerrainGenerator />
        </>
      )}
    </Canvas>
  </ErrorBoundary>;
}
