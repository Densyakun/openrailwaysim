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

export default function Cameras({ target = new THREE.Vector3() }: { target?: THREE.Vector3 }) {
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
        position={[target.x, target.y, target.z + 10]}
      />
      <OrthographicCamera
        ref={orthographicCameraRef}
        makeDefault={mainCameraKey === "orthographicCamera"}
        position={[target.x, target.y + 100, target.z]}
        rotation={[0, 0, -90]}
        zoom={50}
      />
    </>
  )
}
