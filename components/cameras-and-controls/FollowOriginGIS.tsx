import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { proxy } from 'valtio'
import { default as turfDistance } from '@turf/distance'
import { state as camerasState } from './Cameras'
import { state as controlsState } from './CameraControls'
import { state as followOriginState } from './FollowOrigin'

export const sphericalEarthMeridianLength = turfDistance([0, -90], [0, 90], { units: 'meters' })

export const state = proxy<{
  originQuaternion: THREE.Quaternion;
}>({
  originQuaternion: new THREE.Quaternion(),
})

export default function FollowOrigin({ children }: { children?: React.ReactNode }) {
  const groupThatIsTrackingRef = React.useCallback((target?: THREE.Group | null) => {
    followOriginState.groupThatIsTracking.value = target ?? undefined
  }, [])

  useFrame(() => {
    if (followOriginState.groupThatIsTracking.value) {
      const mainCamera = camerasState.cameraRefs[camerasState.mainCameraKey]
      if (mainCamera) {
        state.originQuaternion
          .multiply(
            new THREE.Quaternion()
              .setFromAxisAngle(new THREE.Vector3(0, 1, 0), mainCamera.position.x * Math.PI / sphericalEarthMeridianLength)
          )
          .multiply(
            new THREE.Quaternion()
              .setFromAxisAngle(new THREE.Vector3(1, 0, 0), mainCamera.position.z * Math.PI / sphericalEarthMeridianLength)
          )

        followOriginState.groupThatIsTracking.value.position.sub(mainCamera.position)

        const mainControls = controlsState.controlsRefs[controlsState.mainControlsKey]
        if (mainControls)
          ((mainControls as any).target as THREE.Vector3).sub(mainCamera.position)

        mainCamera.position.set(0, 0, 0)
      }
    }
  })

  return (
    <>
      <group ref={groupThatIsTrackingRef}>
        {children}
      </group>
    </>
  )
}
