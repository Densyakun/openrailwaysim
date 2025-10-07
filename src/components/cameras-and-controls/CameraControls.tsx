import * as React from 'react'
import * as THREE from 'three'
import { OrbitControls as OrbitControlsImpl, MapControls as MapControlsImpl } from 'three-stdlib'
import { OrbitControls, MapControls } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'
import { camerasState } from './Cameras'
import { useFrame } from '@react-three/fiber'

export type ControlsRefs = {
  [key: string]: OrbitControlsImpl | MapControlsImpl
}

export const cameraControlsState = proxy<{
  mainControlsKey: string;
  controlsRefs: ControlsRefs;
  target: THREE.Vector3;
}>({
  mainControlsKey: "orbitControls",
  controlsRefs: ref<ControlsRefs>({}),
  target: new THREE.Vector3(),
})

export default function CameraControls() {
  const { mainControlsKey } = useSnapshot(cameraControlsState)
  const { cameraRefs, mainCameraKey } = useSnapshot(camerasState)

  const orbitControlsRef = React.useCallback((orbitControls: OrbitControlsImpl) => {
    cameraControlsState.controlsRefs["orbitControls"] = orbitControls
  }, [])
  const mapControlsRef = React.useCallback((mapControls: MapControlsImpl) => {
    cameraControlsState.controlsRefs["mapControls"] = mapControls
  }, [])

  useFrame(() => {
    const mainControls = cameraControlsState.controlsRefs[mainControlsKey]
    if (mainControls)
      cameraControlsState.target = (mainControls as OrbitControlsImpl).target.clone()
  })

  return (
    <>
      {
        mainControlsKey === "orbitControls" &&
        <OrbitControls
          ref={orbitControlsRef}
          camera={cameraRefs[mainCameraKey] as THREE.Camera}
          zoomSpeed={5}
          minDistance={1}
        />
      }
      {
        mainControlsKey === "mapControls" &&
        <MapControls
          ref={mapControlsRef}
          camera={cameraRefs[mainCameraKey] as THREE.Camera}
          zoomSpeed={5}
          minDistance={1}
        />
      }
    </>
  )
}
