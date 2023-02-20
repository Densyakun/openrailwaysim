import * as React from 'react'
import * as THREE from 'three'
import { Canvas, Vector3 } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import Cameras from './cameras-and-controls/Cameras'
import CameraControls from './cameras-and-controls/CameraControls'
import FollowCamera, { state as followCameraState } from './cameras-and-controls/FollowCamera'
import TestFeatureCollection from './TestFeatureCollection'

export default function App() {
  const { groupThatIsTracking: { value: groupThatIsTracking } } = useSnapshot(followCameraState)

  const sunPosition: Vector3 = [
    100,
    200,
    300
  ]

  return (
    <Canvas shadows frameloop="demand">
      <Cameras />
      <CameraControls />
      <ambientLight intensity={0.1} />
      <FollowCamera>
        <directionalLight
          castShadow
          position={sunPosition}
          target={groupThatIsTracking as THREE.Object3D | undefined}
        />
        <Sky sunPosition={sunPosition} />
      </FollowCamera>
      <TestFeatureCollection />
    </Canvas>
  )
}
