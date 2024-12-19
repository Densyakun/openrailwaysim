import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { proxy, ref } from 'valtio'
import { state as camerasState } from './Cameras'
import { state as controlsState } from './CameraControls'

export const state = proxy<{
  groupThatIsTracking: {
    value?: THREE.Group;
  };
}>({
  groupThatIsTracking: ref<{
    value?: THREE.Group;
  }>({}),
})

export default function FollowOrigin({ children }: { children?: React.ReactNode }) {
  const groupThatIsTrackingRef = React.useCallback((target?: THREE.Group | null) => {
    state.groupThatIsTracking.value = target ?? undefined
  }, [])

  useFrame(() => {
    if (state.groupThatIsTracking.value) {
      const mainCamera = camerasState.cameraRefs[camerasState.mainCameraKey]
      if (mainCamera) {
        state.groupThatIsTracking.value.position.sub(mainCamera.position)

        const mainControls = controlsState.controlsRefs[controlsState.mainControlsKey]
        if (mainControls)
          ((mainControls as any).target as THREE.Vector3).sub(mainCamera.position)

        mainCamera.position.set(0, 0, 0)
      }
    }
  })

  return (
    <group ref={groupThatIsTrackingRef}>
      {children}
    </group>
  )
}
