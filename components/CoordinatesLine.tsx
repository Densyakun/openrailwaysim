import * as React from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { Position } from '@turf/helpers'
import { coordinateToEuler, getRelativePosition, state as gisState } from '@/lib/gis'

export default function CoordinatesLine({
  featureCollectionId,
  featureIndex,
  coordinates,
  centerCoordinate,
  y = 0
}: {
  featureCollectionId: string,
  featureIndex: number,
  coordinates: Position[],
  centerCoordinate: Position,
  y?: number
}) {
  // Azimuthal equidistant projection
  const points: THREE.Vector3[] = coordinates.map(coordinate => getRelativePosition(coordinate, coordinateToEuler(centerCoordinate), centerCoordinate, 0))

  // 角度に色を付け、線を分類する
  /*return points.map((point, index) => {
    if (index === 0) return null

    const v = point.clone().sub(points[index - 1])
    let h = Math.atan2(v.z, v.x) * 360 / Math.PI + 360
    h = Math.round(h * 36 / 360) * 360 * 360 / 36 / 3

    return <Line
      key={index}
      points={[point, points[index - 1]]}
      color={new THREE.Color(`hsl(${h}, 100%, 50%)`)}
    />
  })*/

  return <>
    {points.map((point, nextPointIndex) => nextPointIndex === 0 ? null :
      <React.Fragment key={nextPointIndex}>
        <Line
          points={[points[nextPointIndex - 1], point]}
          lineWidth={48}
          transparent
          opacity={0}
          onClick={() => {
            const index = gisState.selectedFeatures.findIndex(value =>
              value
              && value.featureCollectionId === featureCollectionId
              && value.featureIndex === featureIndex
              && value.segmentIndex === nextPointIndex - 1
            )

            if (0 <= index)
              gisState.selectedFeatures.splice(index, 1)
            else {
              gisState.selectedFeatures.push({
                featureCollectionId,
                featureIndex,
                segmentIndex: nextPointIndex - 1
              })
            }
          }}
          onPointerOver={() => {
            gisState.hoveredFeatures.push({
              featureCollectionId: featureCollectionId,
              featureIndex: featureIndex,
              segmentIndex: nextPointIndex - 1
            })
          }}
          onPointerOut={() => {
            const index = gisState.hoveredFeatures.findIndex(value =>
              value
              && value.featureCollectionId === featureCollectionId
              && value.featureIndex === featureIndex
              && value.segmentIndex === nextPointIndex - 1
            )

            if (0 <= index)
              delete gisState.hoveredFeatures[index]
          }}
        />
        <Line
          points={[points[nextPointIndex - 1], point]}
          color={
            gisState.hoveredFeatures.find(value =>
              value
              && value.featureCollectionId === featureCollectionId
              && value.featureIndex === featureIndex
              && value.segmentIndex === nextPointIndex - 1
            ) ? "#ff0" :
              gisState.selectedFeatures.find(value =>
                value
                && value.featureCollectionId === featureCollectionId
                && value.featureIndex === featureIndex
                && value.segmentIndex === nextPointIndex - 1
              ) ? "#f00" :
                "#000"
          }
        />
      </React.Fragment>
    )}
  </>
}
