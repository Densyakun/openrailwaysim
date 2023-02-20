import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import FollowCamera, { state as followCameraState } from './cameras-and-controls/FollowCamera'
import { proxy, ref } from 'valtio'

export const skyDistanceHalf = 149600000000

export const state = proxy<{
  directionalLight: { value?: THREE.DirectionalLight };
  elevation: number;
  azimuth: number;
}>({
  directionalLight: ref<{ value?: THREE.DirectionalLight }>({}),
  elevation: 0,
  azimuth: 0,
})

export default function SunAndSky() {
  const directionalLightRef = React.useCallback((directionalLight: THREE.DirectionalLight) => {
    state.directionalLight.value = directionalLight
  }, [])

  const sunPosition = new THREE.Vector3(
    Math.cos(state.azimuth) * Math.cos(state.elevation),
    Math.sin(state.elevation),
    Math.sin(state.azimuth) * Math.cos(state.elevation)
  )

  const [sunSkyPosition, setSunSkyPosition] = React.useState(sunPosition)

  useFrame(() => {
    if (followCameraState.groupThatIsTracking.value) {
      if (state.directionalLight.value)
        state.directionalLight.value.target = followCameraState.groupThatIsTracking.value

      setSunSkyPosition(new THREE.Vector3(
        followCameraState.groupThatIsTracking.value.position.x / skyDistanceHalf + sunPosition.x,
        followCameraState.groupThatIsTracking.value.position.y / skyDistanceHalf + sunPosition.y,
        followCameraState.groupThatIsTracking.value.position.z / skyDistanceHalf + sunPosition.z
      ))
    }
  })

  return (
    <>
      <ambientLight intensity={0.1} />
      <FollowCamera>
        <directionalLight
          ref={directionalLightRef}
          castShadow
          position={sunPosition}
          target={followCameraState.groupThatIsTracking.value}
        />
        <Sky
          distance={skyDistanceHalf * 2}
          sunPosition={sunSkyPosition}
        />
      </FollowCamera>
    </>
  )
}
