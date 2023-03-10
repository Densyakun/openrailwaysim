import * as React from 'react'
import { FeatureCollection, LineString, Position } from '@turf/helpers'
import CoordinatesLine from './CoordinatesLine'

export default function FeatureCollectionComponent({
  featureCollection,
  centerCoordinate
}: {
  featureCollection: FeatureCollection,
  centerCoordinate: Position
}) {
  return (
    <>
      {featureCollection.features.map((feature, index) => {
        switch (feature.geometry.type) {
          case "LineString":
            const lineString = feature.geometry as LineString

            return (
              <CoordinatesLine key={index} coordinates={lineString.coordinates} centerCoordinate={centerCoordinate} />
            )
          default:
            return undefined
        }
      })}
    </>
  )
}
