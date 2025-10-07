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

export default function CanvasContainer() {
  return <Canvas shadows frameloop="demand" style={{
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
    <Trains />
    <Terrains />
    <TerrainGenerator />
    <Client />
  </Canvas>;
}
