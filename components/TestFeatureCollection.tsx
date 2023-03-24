import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { FeatureCollection } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import featureCollection from '@/data/sakurajosui.geojson'
import { coordinateToEuler, getProjectedLines, ProjectedLine, state as gisState } from '@/lib/gis'
import { addNewIdArray } from '@/lib/saveData'
import { axlesToBogie, bogieToAxles, createBogie, state as bogiesState } from '@/lib/bogies'
import { state as featureCollectionsState } from './FeatureCollections'
import { state as tracksState } from './Tracks'

function createCar(projectedLine: ProjectedLine, length = 0) {
  //const distanceBetweenBogiesHalf = 13.8 / 2
  //const wheelbaseHalf = 2.1 / 2
  const wheelbaseHalf = 50

  return [
    createBogie(
      { projectedLine: projectedLine, length: length },
      [
        -wheelbaseHalf,
        wheelbaseHalf,
      ],
    ),
  ]
}

export default function TestFeatureCollection() {
  React.useEffect(() => {
    const featureCollection_: FeatureCollection = featureCollection
    featureCollectionsState.featureCollections = addNewIdArray([{ value: featureCollection_ }])
    tracksState.projectedLines = addNewIdArray(getProjectedLines(featureCollection))

    bogiesState.bogies = addNewIdArray([
      ...createCar(tracksState.projectedLines[1]),
    ])

    gisState.originQuaternion = new THREE.Quaternion().setFromEuler(coordinateToEuler(
      pointOnFeature(featureCollection).geometry.coordinates
    ))
  }, [])

  return null
}
