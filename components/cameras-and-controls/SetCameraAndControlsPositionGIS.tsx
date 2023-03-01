import * as React from 'react'
import * as THREE from 'three'
import { Position } from '@turf/helpers'
import { coordinateToEuler, state as gisState } from '@/lib/gis'

export default function SetCameraAndControlsPositionGIS({ coordinate }: { coordinate: Position }) {
  React.useEffect(() => {
    // Move origin quaternion
    gisState.originQuaternion = new THREE.Quaternion().setFromEuler(coordinateToEuler(coordinate))
  }, [coordinate])

  return null
}
