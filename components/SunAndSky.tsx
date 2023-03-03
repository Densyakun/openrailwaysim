import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import FollowCamera, { state as followCameraState } from './cameras-and-controls/FollowCamera'
import { proxy, ref } from 'valtio'
import { state as dateState } from '@/lib/date'
import { getOriginEuler, state as gisState } from '@/lib/gis'

export const skyDistanceHalf = 149600000000

export const maxAmbientLightIntensity = 0.1

export const directionalLightCameraSize = 1000
export const directionalLightDistance = 10000000

export const state = proxy<{
  directionalLight: { value?: THREE.DirectionalLight };
  elevation: number;
  azimuth: number;
}>({
  directionalLight: ref<{ value?: THREE.DirectionalLight }>({}),
  elevation: 0,
  azimuth: Math.PI / 2,
})

function getSunPosition() {
  const originCoordinateEuler = getOriginEuler()

  return new THREE.Vector3(
    Math.sin(state.azimuth + originCoordinateEuler.z) * Math.cos(state.elevation),
    Math.sin(state.elevation),
    -Math.cos(state.azimuth + originCoordinateEuler.z) * Math.cos(state.elevation)
  )
}

export default function SunAndSky() {
  const [ambientLightIntensity, setAmbientLightIntensity] = React.useState(maxAmbientLightIntensity)

  const directionalLightRef = React.useCallback((directionalLight: THREE.DirectionalLight) => {
    if (state.directionalLight.value = directionalLight) {
      directionalLight.shadow.mapSize.width = 4096
      directionalLight.shadow.mapSize.height = 4096
      directionalLight.shadow.camera.far = directionalLightDistance * 2
      directionalLight.shadow.camera.left = -directionalLightCameraSize
      directionalLight.shadow.camera.bottom = -directionalLightCameraSize
      directionalLight.shadow.camera.right = directionalLightCameraSize
      directionalLight.shadow.camera.top = directionalLightCameraSize
    }
  }, [])

  const sunPosition = getSunPosition()

  const [directionalLightPosition, setDirectionalLightPosition] = React.useState(sunPosition.clone().multiplyScalar(directionalLightDistance))
  const [sunSkyPosition, setSunSkyPosition] = React.useState(sunPosition)
  const [directionalLightIntensity, setDirectionalLightIntensity] = React.useState(1)

  let timeRemainder = 0

  useFrame(({ }, delta) => {
    timeRemainder += delta * 1000
    const deltaMilliseconds = Math.floor(timeRemainder)
    timeRemainder -= deltaMilliseconds
    dateState.nowDate += deltaMilliseconds

    const nowDate = new Date(dateState.nowDate)
    state.elevation =
      (nowDate.getTime() - Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())) * Math.PI / 43200000
      + new THREE.Euler().setFromQuaternion(gisState.originQuaternion, 'YXZ').y
      - Math.PI / 2

    sunPosition.copy(getSunPosition())

    if (followCameraState.groupThatIsTracking.value) {
      setSunSkyPosition(new THREE.Vector3(
        followCameraState.groupThatIsTracking.value.position.x / skyDistanceHalf + sunPosition.x,
        followCameraState.groupThatIsTracking.value.position.y / skyDistanceHalf + sunPosition.y,
        followCameraState.groupThatIsTracking.value.position.z / skyDistanceHalf + sunPosition.z
      ))
    }

    setAmbientLightIntensity((sunPosition.y + 1) * maxAmbientLightIntensity / 2)
    setDirectionalLightIntensity(Math.max(0, Math.min(1, sunPosition.y * 18)))

    setDirectionalLightPosition(sunPosition.clone().multiplyScalar(directionalLightDistance))
  })

  return (
    <>
      <ambientLight intensity={ambientLightIntensity} />
      <directionalLight
        ref={directionalLightRef}
        castShadow
        position={directionalLightPosition}
        intensity={directionalLightIntensity}
      />
      <FollowCamera>
        <Sky
          distance={skyDistanceHalf * 2}
          sunPosition={sunSkyPosition}
        />
      </FollowCamera>
    </>
  )
}
