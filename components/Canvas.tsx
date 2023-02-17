import * as React from 'react'
import { Canvas } from '@react-three/fiber'
import CameraTarget from './cameras-and-controls/CameraTarget'
import TestFeatureCollection from './TestFeatureCollection'

export default function App() {
  return (
    <Canvas shadows frameloop="demand">
      <CameraTarget>
        <TestFeatureCollection />
      </CameraTarget>
    </Canvas>
  )
}
