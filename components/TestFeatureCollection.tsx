import * as React from 'react'
import pointOnFeature from '@turf/point-on-feature'
import FeatureCollection from './FeatureCollection'
import featureCollection from '@/data/sakurajosui.geojson'
import { state } from './cameras-and-controls/CameraTarget'

export default function TestFeatureCollection() {
  let centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

  state.target.value?.position.set(20000000, 0, 0)

  return (
    <FeatureCollection featureCollection={featureCollection} centerCoordinate={centerCoordinate} />
  )
}
