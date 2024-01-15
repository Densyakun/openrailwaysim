import * as React from 'react'
import { LineString, Position } from '@turf/helpers'
import CoordinatesLine from './CoordinatesLine'
import { gameState } from '@/lib/client'

export default function FeatureCollectionComponent({
  featureCollectionId,
  centerCoordinate
}: {
  featureCollectionId: string,
  centerCoordinate: Position
}) {
  return (
    <>
      {gameState.featureCollections[featureCollectionId].value.features.map((feature, index) => {
        switch (feature.geometry.type) {
          case "LineString":
            const lineString = feature.geometry as LineString

            return (
              <CoordinatesLine key={index} featureCollectionId={featureCollectionId} featureIndex={index} coordinates={lineString.coordinates} centerCoordinate={centerCoordinate} />
            )
          default:
            return undefined
        }
      })}
    </>
  )
}
