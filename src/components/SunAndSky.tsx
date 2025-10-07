import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import FollowCamera, { state as followCameraState } from './cameras-and-controls/FollowCamera'
import { useSnapshot } from 'valtio'
import { gameState } from '@/lib/client'
import { guiState, lightingIsForEditing } from '@/lib/client/gui'
import { lightingState } from '@/lib/client/lighting'
import { trainsState } from '@/lib/client/trains'
import { coordinateToEuler } from '@/lib/gis'

export const skyDistanceHalf = 149600000000

export const maxAmbientLightIntensity = 0.1

export const directionalLightCameraSize = 1000
export const directionalLightDistance = 10000000

function getSunPosition() {
  const originCoordinateEuler = coordinateToEuler(gameState.data.originCoordinate)

  return new THREE.Vector3(
    Math.sin(lightingState.azimuth + originCoordinateEuler.z) * Math.cos(lightingState.elevation),
    Math.sin(lightingState.elevation),
    -Math.cos(lightingState.azimuth + originCoordinateEuler.z) * Math.cos(lightingState.elevation)
  )
}

export default function SunAndSky() {
  const { selectedTab } = useSnapshot(guiState);
  useSnapshot(trainsState);

  const ambientLightRef = React.useRef<THREE.AmbientLight>(null)

  const directionalLightRef = React.useRef<THREE.DirectionalLight>(null)
  React.useEffect(() => {
    if (!directionalLightRef.current) return

    if (lightingState.directionalLight.value = directionalLightRef.current) {
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

  useFrame(() => {
    const nowDate = new Date(gameState.data.nowDate)
    lightingState.elevation =
      (nowDate.getTime() - Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())) * Math.PI / 43200000
      + coordinateToEuler(gameState.data.originCoordinate).y
      - Math.PI / 2

    sunPosition.copy(getSunPosition())

    if (followCameraState.groupThatIsTracking.value) {
      setSunSkyPosition(new THREE.Vector3(
        followCameraState.groupThatIsTracking.value.position.x / skyDistanceHalf + sunPosition.x,
        followCameraState.groupThatIsTracking.value.position.y / skyDistanceHalf + sunPosition.y,
        followCameraState.groupThatIsTracking.value.position.z / skyDistanceHalf + sunPosition.z
      ))
    }

    const lightingIsForEditing_ = lightingIsForEditing(selectedTab);
    ambientLightRef.current!.intensity = lightingIsForEditing_
      ? 1
      : ((sunPosition.y + 1) * maxAmbientLightIntensity / 2);
    directionalLightRef.current!.intensity = lightingIsForEditing_
      ? 0
      : Math.max(0, Math.min(1, sunPosition.y * 18));

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
        {lightingIsForEditing(selectedTab)
          ? <Environment background={true} />
          : <Sky
            distance={skyDistanceHalf * 2}
            sunPosition={sunSkyPosition}
          />
        }
      </FollowCamera>
    </>
  )
}
