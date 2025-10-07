import * as React from 'react'
import * as THREE from 'three'
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'
import { clientState } from '@/lib/client'

export type CameraRefs = {
  [key: string]: THREE.Camera
}

export const camerasState = proxy<{
  mainCameraKey: string,
  cameraRefs: CameraRefs
}>({
  mainCameraKey: "perspectiveCamera",
  cameraRefs: ref<CameraRefs>({})
})

export default function Cameras() {
  const { mainCameraKey } = useSnapshot(camerasState)
  const { cameraFar } = useSnapshot(clientState)

  const perspectiveCameraRef = React.useCallback((perspectiveCamera: THREE.PerspectiveCamera) => {
    camerasState.cameraRefs["perspectiveCamera"] = perspectiveCamera
  }, [])
  const orthographicCameraRef = React.useCallback((orthographicCamera: THREE.OrthographicCamera) => {
    camerasState.cameraRefs["orthographicCamera"] = orthographicCamera
  }, [])

  return (
    <>
      <PerspectiveCamera
        ref={perspectiveCameraRef}
        makeDefault={mainCameraKey === "perspectiveCamera"}
        position={[10, 20, 30]}
        far={cameraFar}
      />
      <OrthographicCamera
        ref={orthographicCameraRef}
        makeDefault={mainCameraKey === "orthographicCamera"}
        position={[10, 20, 30]}
        far={cameraFar}
      />
    </>
  )
}
