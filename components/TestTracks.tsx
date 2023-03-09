import * as React from 'react'
import * as THREE from 'three'
import pointOnFeature from '@turf/point-on-feature'
import { coordinateToEuler, getProjectedLines, state as gisState } from '@/lib/gis'
import { state as tracksState } from './Tracks'
import featureCollection from '@/data/sakurajosui.geojson'

export default function TestTracks() {
  React.useEffect(() => {
    tracksState.projectedLines = getProjectedLines(featureCollection)

    gisState.originQuaternion = new THREE.Quaternion().setFromEuler(coordinateToEuler(
      pointOnFeature(featureCollection).geometry.coordinates
    ))
  }, [])

  return null
}
