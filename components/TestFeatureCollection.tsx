import * as React from 'react'
import * as THREE from 'three'
import pointOnFeature from '@turf/point-on-feature'
import FeatureCollection from './FeatureCollection'
import featureCollection from '@/data/sakurajosui.geojson'
import { state } from './cameras-and-controls/CamerasAndControls'

export default function TestFeatureCollection() {
  let centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

  const target: THREE.Vector3 = new THREE.Vector3(20000000, 0, 0)
  state.target = target

  return (
    <mesh position={target}>
      <FeatureCollection featureCollection={featureCollection} centerCoordinate={centerCoordinate} />
    </mesh>
  )
}
