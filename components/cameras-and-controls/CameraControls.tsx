import * as React from 'react'
import { Camera } from 'three'
import { OrbitControls as OrbitControlsImpl, MapControls as MapControlsImpl } from 'three-stdlib'
import { Vector3 } from '@react-three/fiber'
import { OrbitControls, MapControls } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'
import { state as cameraState } from './Cameras'

export type ControlsRefs = {
  [key: string]: THREE.EventDispatcher
}

export const state = proxy<{
  mainControlsKey: string,
  controlsRefs: ControlsRefs
}>({
  mainControlsKey: "orbitControls",
  controlsRefs: ref<ControlsRefs>({})
})

export default function CameraControls({ target }: { target?: Vector3 }) {
  const { mainControlsKey } = useSnapshot(state)
  const { cameraRefs, mainCameraKey } = useSnapshot(cameraState)

  const orbitControlsRef = React.useCallback((orbitControls: OrbitControlsImpl) => {
    state.controlsRefs["orbitControls"] = orbitControls
  }, [])
  const mapControlsRef = React.useCallback((mapControls: MapControlsImpl) => {
    state.controlsRefs["mapControls"] = mapControls
  }, [])

  return (
    <>
      {
        mainControlsKey === "orbitControls" &&
        <OrbitControls
          ref={orbitControlsRef}
          camera={cameraRefs[mainCameraKey] as Camera}
          target={target}
        />
      }
      {
        mainControlsKey === "mapControls" &&
        <MapControls
          ref={mapControlsRef}
          camera={cameraRefs[mainCameraKey] as Camera}
          target={target}
        />
      }
    </>
  )
}
