import * as React from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { Position } from '@turf/helpers'
import { coordinateToEuler, getRelativePosition } from '@/lib/gis'

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
  const points: THREE.Vector3[] = coordinates.map(coordinate => getRelativePosition(coordinate, coordinateToEuler(centerCoordinate), centerCoordinate, 0))

  return (
    <Line
      points={points}
    />
  )
}
