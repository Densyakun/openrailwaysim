import * as React from 'react'
import * as THREE from 'three'
import { OrbitControls, MapControls } from 'three-stdlib'
import { useThree } from '@react-three/fiber'
import { state as camerasState } from './Cameras'
import { state as controlsState } from './CameraControls'

export default function TestFeatureCollection({ centerPosition }: { centerPosition: THREE.Vector3 }) {
  const { invalidate } = useThree()

  React.useEffect(() => {
    // Move camera and controls targets
    const mainCamera = camerasState.cameraRefs[camerasState.mainCameraKey]
    const mainControls = controlsState.controlsRefs[controlsState.mainControlsKey] as OrbitControls | MapControls
    if (mainCamera && mainControls) {
      const move = centerPosition.sub(controlsState.target)
      mainCamera.position.add(move);
      mainControls.target = controlsState.target.add(move);
      mainControls.update()
      invalidate()
    }
  }, [invalidate])

  return null
}
