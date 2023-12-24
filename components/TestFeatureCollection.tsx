import * as React from 'react'
import { setCameraTargetPosition } from './cameras-and-controls/CameraControls'
import { gameState } from '@/lib/client';

export default function TestFeatureCollection() {
  React.useEffect(() => {
    const targetProjectedLine = gameState.projectedLines["1"]
    if (!targetProjectedLine) return

    // Setting up the camera
    const targetCoordinate = gameState.projectedLines["1"].centerCoordinate
    const targetElevation = 0 < gameState.projectedLines["1"].points.length ? gameState.projectedLines["1"].points[0].y : 0
    setCameraTargetPosition(targetCoordinate, targetElevation)
  }, [gameState.projectedLines])

  return null
}
