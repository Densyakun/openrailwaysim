import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { state as gisState, move } from '@/lib/gis'
import { state as camerasState } from './Cameras'
import { state as controlsState } from './CameraControls'

export default function FollowOriginGIS() {
  useFrame(() => {
    const mainCamera = camerasState.cameraRefs[camerasState.mainCameraKey]
    if (mainCamera) {
      move(gisState.originQuaternion, mainCamera.position.x, mainCamera.position.z)

      gisState.elevation += mainCamera.position.y

      const mainControls = controlsState.controlsRefs[controlsState.mainControlsKey]
      if (mainControls)
        ((mainControls as any).target as THREE.Vector3).sub(mainCamera.position)

      mainCamera.position.set(0, 0, 0)
    }
  })

  return null
}
