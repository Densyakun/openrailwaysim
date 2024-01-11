import * as React from 'react'
import * as THREE from 'three'
import { OrbitControls as OrbitControlsImpl, MapControls as MapControlsImpl } from 'three-stdlib'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, MapControls } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'
import { state as cameraState } from './Cameras'
import { Position } from '@turf/helpers'
import { coordinateToEuler, move, state as gisState } from '@/lib/gis'

export type ControlsRefs = {
  [key: string]: THREE.EventDispatcher
}

export const state = proxy<{
  mainControlsKey: string;
  controlsRefs: ControlsRefs;
  target: THREE.Vector3;
}>({
  mainControlsKey: "orbitControls",
  controlsRefs: ref<ControlsRefs>({}),
  target: new THREE.Vector3()
})

export function setCameraTargetPosition(targetCoordinate: Position, targetElevation?: number) {
  gisState.originTransform.quaternion.copy(new THREE.Quaternion().setFromEuler(coordinateToEuler(targetCoordinate)))
  const mainControls = state.controlsRefs[state.mainControlsKey]
  if (mainControls) {
    const controlsTargetPosition = ((mainControls as any).target as THREE.Vector3)
    move(gisState.originTransform.quaternion, -controlsTargetPosition.x, -controlsTargetPosition.z)
    if (targetElevation !== undefined)
      gisState.originTransform.elevation = targetElevation - controlsTargetPosition.y
  }
}

export default function CameraControls() {
  const { invalidate } = useThree()

  const { controlsRefs, mainControlsKey, target } = useSnapshot(state)
  const { cameraRefs, mainCameraKey } = useSnapshot(cameraState)

  const orbitControlsRef = React.useCallback((orbitControls: OrbitControlsImpl) => {
    state.controlsRefs["orbitControls"] = orbitControls
  }, [])
  const mapControlsRef = React.useCallback((mapControls: MapControlsImpl) => {
    state.controlsRefs["mapControls"] = mapControls
  }, [])

  useFrame(({ }, delta) => {
    const mainControls = controlsRefs[mainControlsKey]
    if (mainControls) {
      state.target = (mainControls as any).target = target;
      (mainControls as any).update()
      invalidate()
    }
  })

  return (
    <>
      {
        mainControlsKey === "orbitControls" &&
        <OrbitControls
          ref={orbitControlsRef}
          camera={cameraRefs[mainCameraKey] as THREE.Camera}
        />
      }
      {
        mainControlsKey === "mapControls" &&
        <MapControls
          ref={mapControlsRef}
          camera={cameraRefs[mainCameraKey] as THREE.Camera}
        />
      }
    </>
  )
}
