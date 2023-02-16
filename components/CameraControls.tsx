import * as React from 'react'
import { Camera } from 'three'
import { OrbitControls, MapControls } from '@react-three/drei'
import { proxy, useSnapshot } from 'valtio'
import { state as cameraState } from './Cameras'

export const state = proxy({ controlsType: "orbitControls" })

export default function CameraControls() {
  const { controlsType } = useSnapshot(state)
  const { cameraRefs, mainCameraKey } = useSnapshot(cameraState)

  return (
    <>
      {
        controlsType === "orbitControls" &&
        <OrbitControls camera={cameraRefs[mainCameraKey] as Camera} />
      }
      {
        controlsType === "mapControls" &&
        <MapControls camera={cameraRefs[mainCameraKey] as Camera} />
      }
    </>
  )
}
