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
  const ambientLightRef = React.useRef<THREE.AmbientLight>(null)

  const directionalLightRef = React.useRef<THREE.DirectionalLight>(null)
  React.useEffect(() => {
    if (!directionalLightRef.current) return

    if (state.directionalLight.value = directionalLightRef.current) {
      directionalLightRef.current.shadow.mapSize.width = 4096
      directionalLightRef.current.shadow.mapSize.height = 4096
      directionalLightRef.current.shadow.camera.far = directionalLightDistance * 2
      directionalLightRef.current.shadow.camera.left = -directionalLightCameraSize
      directionalLightRef.current.shadow.camera.bottom = -directionalLightCameraSize
      directionalLightRef.current.shadow.camera.right = directionalLightCameraSize
      directionalLightRef.current.shadow.camera.top = directionalLightCameraSize
    }
  }, [])

  const sunPosition = getSunPosition()

  const [sunSkyPosition, setSunSkyPosition] = React.useState(sunPosition)

  let timeRemainder = 0

  useFrame(({ }, delta) => {
    timeRemainder += delta * 1000
    const deltaMilliseconds = Math.floor(timeRemainder)
    timeRemainder -= deltaMilliseconds
    dateState.nowDate += deltaMilliseconds

    const nowDate = new Date(dateState.nowDate)
    state.elevation =
      (nowDate.getTime() - Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())) * Math.PI / 43200000
      + new THREE.Euler().setFromQuaternion(gisState.originTransform.quaternion, 'YXZ').y
      - Math.PI / 2

    sunPosition.copy(getSunPosition())

    if (followCameraState.groupThatIsTracking.value) {
      setSunSkyPosition(new THREE.Vector3(
        followCameraState.groupThatIsTracking.value.position.x / skyDistanceHalf + sunPosition.x,
        followCameraState.groupThatIsTracking.value.position.y / skyDistanceHalf + sunPosition.y,
        followCameraState.groupThatIsTracking.value.position.z / skyDistanceHalf + sunPosition.z
      ))
    }

    ambientLightRef.current!.intensity = ((sunPosition.y + 1) * maxAmbientLightIntensity / 2)
    directionalLightRef.current!.intensity = Math.max(0, Math.min(1, sunPosition.y * 18))

    directionalLightRef.current!.position.copy(sunPosition.clone().multiplyScalar(directionalLightDistance))
  })

  return (
    <>
      <ambientLight ref={ambientLightRef} />
      <directionalLight
        ref={directionalLightRef}
        castShadow
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
