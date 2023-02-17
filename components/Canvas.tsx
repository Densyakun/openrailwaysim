import * as React from 'react'
import { Canvas, Vector3 } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import CameraTarget from './cameras-and-controls/CameraTarget'
import TestFeatureCollection from './TestFeatureCollection'

export default function App() {
  const sunPosition: Vector3 = [100, 200, 300]

  return (
    <Canvas shadows frameloop="demand">
      <ambientLight intensity={0.1} />
      <directionalLight castShadow position={sunPosition} />
      <CameraTarget>
        <Sky sunPosition={sunPosition} />
        <TestFeatureCollection />
      </CameraTarget>
    </Canvas>
  )
}
