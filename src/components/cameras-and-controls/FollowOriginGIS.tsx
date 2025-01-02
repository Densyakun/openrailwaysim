import { useFrame } from '@react-three/fiber'
import { onMovedCamera } from '@/lib/gis'
import { state as camerasState } from './Cameras'
import { state as controlsState } from './CameraControls'

export default function FollowOriginGIS() {
  useFrame(() => {
    const mainCamera = camerasState.cameraRefs[camerasState.mainCameraKey]
    const mainControls = controlsState.controlsRefs[controlsState.mainControlsKey]

    if (mainCamera && mainControls && (mainCamera.position.x || mainCamera.position.z || mainCamera.position.y))
      onMovedCamera(mainCamera, mainControls)
  })

  return null
}
