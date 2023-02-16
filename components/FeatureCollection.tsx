import * as React from 'react'
import { FeatureCollection, LineString, Position } from '@turf/helpers'
import CoordinatesLine from './CoordinatesLine'

export default ({
  featureCollection,
  centerCoordinate
}: {
  featureCollection: FeatureCollection,
  centerCoordinate: Position
}) => (
  <>
    {featureCollection.features.map(feature => {
      switch (feature.geometry.type) {
        case "LineString":
          const lineString = feature.geometry as LineString

          return (
            <CoordinatesLine coordinates={lineString.coordinates} centerCoordinate={centerCoordinate} />
          )
        default:
          return undefined
      }
    })}
  </>
)
