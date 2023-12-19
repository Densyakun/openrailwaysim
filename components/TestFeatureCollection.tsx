import * as React from 'react'
import * as THREE from "three";
import { FeatureCollection } from '@turf/helpers'
import featureCollection from '@/data/sakurajosui.geojson'
import { getProjectedLines } from '@/lib/gis'
import { addNewIdArray } from '@/lib/saveData'
import { state as trainsState } from '@/lib/trains'
import { state as featureCollectionsState } from './FeatureCollections'
import { state as tracksState } from './Tracks'
import { state as skyState } from './SunAndSky'
import { setCameraTargetPosition } from './cameras-and-controls/CameraControls'
import { createJNR103Series, createTestMalletLocomotive, createTestShikiSeries700, createTestTwoAxlesCar, createTestTwoAxlesCarWithBogies, createTestTwoBogiesCar, createTestTwoBogiesTwoCars, createTestTwoCarsWithJacobsBogies, createUIKeiseiAESeriesMasterController, createUISotetsu20000SeriesMasterController } from '@/lib/trainSamples'

export default function TestFeatureCollection() {
  React.useEffect(() => {
    const featureCollection_: FeatureCollection = featureCollection
    featureCollectionsState.featureCollections = addNewIdArray([{ value: featureCollection_ }])
    tracksState.projectedLines = addNewIdArray(getProjectedLines(featureCollection_))

    // Loop line test
    /*const points = []
    const radius = 20
    const pointCount = 64
    const loopCount = 2
    const euler = new THREE.Euler(0.5)
    for (let i = 0; i < pointCount * loopCount; i++) {
      points[i] = new THREE.Vector3(
        Math.cos(Math.PI * 2 * i / pointCount) * radius,
        0,
        Math.sin(Math.PI * 2 * i / pointCount) * radius
      ).applyEuler(euler)
    }
    tracksState.projectedLines[1].points = points*/

    trainsState.uiOneHandleMasterControllerConfigs = [
      //createUIKeiseiAESeriesMasterController(),
      createUISotetsu20000SeriesMasterController(),
    ];

    trainsState.trains = addNewIdArray([
      //createTestTwoAxlesCar(tracksState.projectedLines[1], 0, 0),
      //createTestTwoAxlesCarWithBogies(tracksState.projectedLines[1]),
      //createTestTwoBogiesCar(tracksState.projectedLines[1], 0),
      //createTestTwoBogiesTwoCars(tracksState.projectedLines[1]),
      createJNR103Series(tracksState.projectedLines[1], 0, 0),
      //createTestTwoCarsWithJacobsBogies(tracksState.projectedLines[1]),
      //createTestMalletLocomotive(tracksState.projectedLines[1]),
      //createTestShikiSeries700(tracksState.projectedLines[1]),
    ])

    // Setting up the camera
    //const targetCoordinate = pointOnFeature(featureCollection_).geometry.coordinates
    const targetCoordinate = tracksState.projectedLines[1].centerCoordinate
    const targetElevation = 0 < tracksState.projectedLines[1].points.length ? tracksState.projectedLines[1].points[0].y : 0
    setCameraTargetPosition(targetCoordinate, targetElevation)

    //skyState.elevation = 1
  }, [])

  return null
}
