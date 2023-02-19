import * as React from 'react'
import { Canvas } from '@react-three/fiber'
import Cameras from './cameras-and-controls/Cameras'
import CameraControls from './cameras-and-controls/CameraControls'
import CameraTarget from './cameras-and-controls/CameraTarget'
import TestFeatureCollection from './TestFeatureCollection'

export default function App() {
  return (
    <Canvas shadows frameloop="demand">
      <Cameras />
      <CameraControls />
      <CameraTarget>
        <TestFeatureCollection />
      </CameraTarget>
    </Canvas>
  )
}
