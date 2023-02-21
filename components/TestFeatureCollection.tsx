import * as React from 'react'
import * as THREE from 'three'
import { OrbitControls, MapControls } from 'three-stdlib'
import { useThree } from '@react-three/fiber'
import { state as camerasState } from './cameras-and-controls/Cameras'
import { state as controlsState } from './cameras-and-controls/CameraControls'
import { state as sunAndSkyState } from './SunAndSky'
import pointOnFeature from '@turf/point-on-feature'
import FeatureCollection from './FeatureCollection'
import featureCollection from '@/data/sakurajosui.geojson'

const centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

const centerPosition = new THREE.Vector3(
  //200000000,
  0,
  0,
  0
)

export default function TestFeatureCollection() {
  const { invalidate } = useThree()

  React.useEffect(() => {
    // Move camera and controls targets
    const mainCamera = camerasState.cameraRefs[camerasState.mainCameraKey]
    const mainControls = controlsState.controlsRefs[controlsState.mainControlsKey] as OrbitControls | MapControls
    if (mainCamera && mainControls) {
      const move = centerPosition.sub(controlsState.target)
      mainCamera.position.add(move);
      mainControls.target = controlsState.target.add(move);
      mainControls.update()
      invalidate()
    }

    // Set sun position
    sunAndSkyState.elevation = 1
  }, [invalidate])

  return (
    <group position={centerPosition}>
      <FeatureCollection featureCollection={featureCollection} centerCoordinate={centerCoordinate} />
    </group>
  )
}
