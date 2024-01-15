import { setCameraTargetPosition } from '@/components/cameras-and-controls/CameraControls'
import { gameState } from '@/lib/client'
import centroid from '@turf/centroid'

export function setCameraToTestLine() {
  const targetFeatureCollection = gameState.featureCollections["0"]
  if (!targetFeatureCollection) return

  // Setting up the camera
  const targetCoordinate = centroid(targetFeatureCollection.value).geometry.coordinates
  const targetElevation = 0
  setCameraTargetPosition(targetCoordinate, targetElevation)
}
