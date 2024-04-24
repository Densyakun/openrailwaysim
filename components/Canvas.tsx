import * as React from 'react'
import { Canvas } from '@react-three/fiber'
import Cameras from './cameras-and-controls/Cameras'
import CameraControls from './cameras-and-controls/CameraControls'
import FollowOriginGIS from './cameras-and-controls/FollowOriginGIS'
import SunAndSky from './SunAndSky'
import DreiSegments from './DreiSegments'
import FeatureCollections from './FeatureCollections'
import Tracks from './Tracks'
import Trains from './Trains'
import Terrains from './Terrains'
import TerrainGenerator from './TerrainGenerator'
import Client from './Client'

export default function App() {
  return (
    <Canvas shadows frameloop="demand">
      <Cameras />
      <CameraControls />
      <SunAndSky />
      <FollowOriginGIS />
      <DreiSegments />
      <FeatureCollections />
      <Tracks />
      <Trains />
      <Terrains />
      <TerrainGenerator />
      <Client />
    </Canvas>
  )
}
