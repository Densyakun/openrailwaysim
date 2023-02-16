import * as React from 'react'
import pointOnFeature from '@turf/point-on-feature'
import FeatureCollection from './FeatureCollection'
import featureCollection from '@/data/sakurajosui.geojson'

export default function () {
  const centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

  return (
    <FeatureCollection featureCollection={featureCollection} centerCoordinate={centerCoordinate} />
  )
}
