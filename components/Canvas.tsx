import * as React from 'react'
import { Canvas } from '@react-three/fiber'
import Cameras from './cameras-and-controls/Cameras'
import CameraControls from './cameras-and-controls/CameraControls'
import SunAndSky from './SunAndSky'
import TestFeatureCollection from './TestFeatureCollection'

export default function App() {
  return (
    <Canvas shadows frameloop="demand">
      <Cameras />
      <CameraControls />
      <SunAndSky />
      <TestFeatureCollection />
    </Canvas>
  )
}
