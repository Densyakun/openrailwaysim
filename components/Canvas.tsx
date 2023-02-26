import * as React from 'react'
import { Canvas } from '@react-three/fiber'
import Cameras from './cameras-and-controls/Cameras'
import CameraControls from './cameras-and-controls/CameraControls'
import FollowOriginGIS from './cameras-and-controls/FollowOriginGIS'
import SunAndSky from './SunAndSky'
import TestFeatureCollection from './TestFeatureCollection'
import ProjectionTest from './ProjectionTest'

export default function App() {
  return (
    <Canvas shadows frameloop="demand">
      <Cameras />
      <CameraControls />
      <SunAndSky />
      <FollowOriginGIS />
      <TestFeatureCollection />
      <ProjectionTest />
    </Canvas>
  )
}
