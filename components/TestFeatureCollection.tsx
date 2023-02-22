import * as React from 'react'
import * as THREE from 'three'
import { state as sunAndSkyState } from './SunAndSky'
import SetCameraAndControlsPosition from './cameras-and-controls/SetCameraAndControlsPosition'
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
  React.useEffect(() => {
    // Set sun position
    sunAndSkyState.elevation = 1
  }, [])

  return (
    <>
      <SetCameraAndControlsPosition centerPosition={centerPosition} />
      <group position={centerPosition}>
        <FeatureCollection featureCollection={featureCollection} centerCoordinate={centerCoordinate} />
      </group>
    </>
  )
}
