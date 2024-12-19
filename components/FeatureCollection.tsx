import * as React from 'react'
import { LineString, Point, Position } from 'geojson'
import CoordinatesLine from './CoordinatesLine'
import { gameState } from '@/lib/client'
import { Billboard, ScreenSizer, Text } from '@react-three/drei'
import { coordinateToEuler, getRelativePosition } from '@/lib/gis'

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
          case "Point":
            const point = feature.geometry as Point

            return (
              <ScreenSizer
                key={index}
                position={getRelativePosition(point.coordinates, coordinateToEuler(centerCoordinate), centerCoordinate, 0)}
                scale={1}
              >
                <Billboard
                  follow={true}
                  lockX={false}
                  lockY={false}
                  lockZ={false}
                >
                  <Text
                    fontSize={13} color="black" anchorY="bottom-baseline" textAlign='center'>
                    {`${feature.properties?.name}\n-`}
                  </Text>
                </Billboard>
              </ScreenSizer>
            )
          default:
            return undefined
        }
      })}
    </>
  )
}
