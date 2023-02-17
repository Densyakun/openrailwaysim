import * as React from 'react'
import { Canvas, Vector3 } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import CamerasAndControls from './cameras-and-controls/CamerasAndControls'
import TestFeatureCollection from './TestFeatureCollection'

export default function App() {
  const sunPosition: Vector3 = [100, 200, 300]

  return (
    <Canvas shadows frameloop="demand">
      <ambientLight intensity={0.1} />
      <directionalLight castShadow position={sunPosition} />
      <CamerasAndControls />
      <Sky sunPosition={sunPosition} />
      <TestFeatureCollection />
    </Canvas>
  )
}
