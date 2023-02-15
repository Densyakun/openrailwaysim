import * as React from 'react'
import { Canvas, Vector3 } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { EffectComposer, DepthOfField, Bloom } from '@react-three/postprocessing'
import Cameras from './Cameras'
import CameraControls from './CameraControls'

export default function App() {
  const sunPosition: Vector3 = [100, 200, 300]

  return (
    <Canvas shadows frameloop="demand">
      <ambientLight intensity={0.1} />
      <directionalLight castShadow position={sunPosition} />
      <Cameras />
      <CameraControls />
      <Sky sunPosition={sunPosition} />
      <mesh receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </mesh>
      <mesh castShadow position={[1, 2, 3]}>
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
      <EffectComposer>
        <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
        <Bloom luminanceThreshold={0} luminanceSmoothing={0.9} height={300} />
      </EffectComposer>
    </Canvas>
  )
}
