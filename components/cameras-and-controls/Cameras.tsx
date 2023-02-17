import * as React from 'react'
import * as THREE from 'three'
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'

export type CameraRefs = {
  [key: string]: THREE.Camera
}

export const state = proxy<{
  mainCameraKey: string,
  cameraRefs: CameraRefs
}>({
  mainCameraKey: "perspectiveCamera",
  cameraRefs: ref<CameraRefs>({})
})

export default function Cameras({ position = new THREE.Vector3() }: { position?: THREE.Vector3 }) {
  const { mainCameraKey } = useSnapshot(state)

  const perspectiveCameraRef = React.useCallback((perspectiveCamera: THREE.PerspectiveCamera) => {
    state.cameraRefs["perspectiveCamera"] = perspectiveCamera
  }, [])
  const orthographicCameraRef = React.useCallback((orthographicCamera: THREE.OrthographicCamera) => {
    state.cameraRefs["orthographicCamera"] = orthographicCamera
  }, [])

  return (
    <>
      <PerspectiveCamera
        ref={perspectiveCameraRef}
        makeDefault={mainCameraKey === "perspectiveCamera"}
        position={[position.x, position.y, position.z + 10]}
      />
      <OrthographicCamera
        ref={orthographicCameraRef}
        makeDefault={mainCameraKey === "orthographicCamera"}
        position={[position.x, position.y + 100, position.z]}
        rotation={[0, 0, -90]}
        zoom={50}
      />
    </>
  )
}
