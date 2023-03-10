import * as React from 'react'
import * as THREE from 'three'
import { FeatureCollection } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import featureCollection from '@/data/sakurajosui.geojson'
import { coordinateToEuler, getProjectedLines, state as gisState } from '@/lib/gis'
import { addNewIdArray } from '@/lib/saveData'
import { state as featureCollectionsState } from './FeatureCollections'
import { state as tracksState } from './Tracks'

export default function TestFeatureCollection() {
  React.useEffect(() => {
    const featureCollection_: FeatureCollection = featureCollection
    featureCollectionsState.featureCollections = addNewIdArray([{ value: featureCollection_ }])
    tracksState.projectedLines = addNewIdArray(getProjectedLines(featureCollection))

    gisState.originQuaternion = new THREE.Quaternion().setFromEuler(coordinateToEuler(
      pointOnFeature(featureCollection).geometry.coordinates
    ))
  }, [])

  return null
}
