import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { proxy, ref, useSnapshot } from 'valtio'
import { state as camerasState } from './Cameras'

export const state = proxy<{
  groupThatIsTracking: {
    value?: THREE.Group;
  };
}>({
  groupThatIsTracking: ref<{
    value?: THREE.Group;
  }>({}),
})

export default function FollowCamera({ children }: { children?: React.ReactNode }) {
  const groupThatIsTrackingRef = React.useCallback((target?: THREE.Group | null) => {
    state.groupThatIsTracking.value = target ?? undefined
  }, [])

  useFrame(() => {
    if (state.groupThatIsTracking.value) {
      const mainCamera = camerasState.cameraRefs[camerasState.mainCameraKey]
      if (mainCamera) state.groupThatIsTracking.value!.position.set(
        mainCamera.position.x,
        mainCamera.position.y,
        mainCamera.position.z
      )
    }
  })

  return (
    <group ref={groupThatIsTrackingRef}>
      {children}
    </group>
  )
}
