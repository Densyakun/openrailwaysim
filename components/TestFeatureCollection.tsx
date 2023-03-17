import * as React from 'react'
import * as THREE from 'three'
import { FeatureCollection } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import featureCollection from '@/data/sakurajosui.geojson'
import { coordinateToEuler, getProjectedLines, ProjectedLine, state as gisState } from '@/lib/gis'
import { addNewIdArray } from '@/lib/saveData'
import { state as featureCollectionsState } from './FeatureCollections'
import { state as tracksState } from './Tracks'
import { state as wheelAndAxlesState } from './WheelAndAxles'

function createCar(projectedLine: ProjectedLine, length: number) {
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2
  return [
    { projectedLine: projectedLine, length: length - distanceBetweenBogiesHalf - wheelbaseHalf },
    { projectedLine: projectedLine, length: length - distanceBetweenBogiesHalf + wheelbaseHalf },
    { projectedLine: projectedLine, length: length + distanceBetweenBogiesHalf - wheelbaseHalf },
    { projectedLine: projectedLine, length: length + distanceBetweenBogiesHalf + wheelbaseHalf },
  ]
}

export default function TestFeatureCollection() {
  React.useEffect(() => {
    const featureCollection_: FeatureCollection = featureCollection
    featureCollectionsState.featureCollections = addNewIdArray([{ value: featureCollection_ }])
    tracksState.projectedLines = addNewIdArray(getProjectedLines(featureCollection))

    wheelAndAxlesState.axles = addNewIdArray([
      ...createCar(tracksState.projectedLines[1], 0),
    ])

    gisState.originQuaternion = new THREE.Quaternion().setFromEuler(coordinateToEuler(
      pointOnFeature(featureCollection).geometry.coordinates
    ))
  }, [])

  return null
}
