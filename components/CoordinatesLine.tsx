import * as React from 'react'
import { Line } from '@react-three/drei'
import { default as turfBearing } from '@turf/bearing'
import { default as turfDistance } from '@turf/distance'
import { Position } from '@turf/helpers'

export default function CoordinatesLine({
  coordinates,
  centerCoordinate,
  y = 0
}: {
  coordinates: Position[],
  centerCoordinate: Position,
  y?: number
}) {
  // Azimuthal equidistant projection
  const points: [number, number, number][] = coordinates.map(coordinate => {
    const distance = turfDistance(centerCoordinate!, coordinate, { units: 'meters' })
    const radian = (turfBearing(centerCoordinate!, coordinate) - 90) * Math.PI / 180

    return [
      Math.cos(radian) * distance,
      y,
      Math.sin(radian) * distance
    ]
  })

  return (
    <Line
      points={points}
    />
  )
}
