import * as React from 'react'
import * as THREE from 'three'
import { FeatureCollection } from '@turf/helpers'
import featureCollection from '@/data/sakurajosui.geojson'
import { coordinateToEuler, getProjectedLines, ProjectedLine, ProjectedLineAndLength } from '@/lib/gis'
import { addNewIdArray } from '@/lib/saveData'
import { Axle, BodySupporterJoint, Bogie, CarBody, Joint, state as trainsState, Train, calcJointsToRotateBody, placeTrain, UIOneHandleMasterControllerConfig, OneHandleMasterController } from '@/lib/trains'
import { state as featureCollectionsState } from './FeatureCollections'
import { state as tracksState } from './Tracks'
import { state as skyState } from './SunAndSky'
import { setCameraTargetPosition } from './cameras-and-controls/CameraControls'

function createCarBody(): CarBody {
  return {
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
  }
}

function createBogie({ projectedLine, length }: ProjectedLineAndLength, axlesZ: number[], masterControllers: OneHandleMasterController[] = []): Bogie {
  return {
    ...createCarBody(),
    axles: axlesZ.map(z => ({
      pointOnTrack: { projectedLine: projectedLine, length: length + z },
      z,
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
    })),
    masterControllers,
  }
}

function getGlobalEulerOfFirstAxle(axle: Axle) {
  return coordinateToEuler(axle.pointOnTrack.projectedLine.centerCoordinate || [0, 0])
}

function createTrain(bogies: Bogie[], otherBodies: CarBody[] = [], bodySupporterJoints: BodySupporterJoint[] = [], otherJoints: Joint[] = []): Train {
  const train: Train = {
    bogies,
    otherBodies,
    bodySupporterJoints,
    otherJoints,
    fromJointIndexes: [],
    toJointIndexes: [],
    globalPosition: getGlobalEulerOfFirstAxle(bogies[0].axles[0]),
    speed: 0,
  }

  calcJointsToRotateBody(train)

  // 連結器の向きを反転させないため
  placeTrain(train)

  return train
}

function createUIOneHandleMasterControllerConfig(): UIOneHandleMasterControllerConfig {
  //return createUIKeiseiAESeriesMasterController()
  return createUISotetsu20000SeriesMasterController()
}

function createUISotetsu20000SeriesMasterController(): UIOneHandleMasterControllerConfig {
  return {
    steps: [
      0,
      4,
      8,
      12,
      16,
      19,
      21,
      23,
      25,
      27,
      29,
      31,
      34,
      37,
    ],
    marks: [
      {
        value: 0,
        label: 'P4',
      },
      {
        value: 4,
        label: 'P3',
      },
      {
        value: 8,
        label: 'P2',
      },
      {
        value: 12,
        label: 'P1',
      },
      {
        value: 16,
        label: '切',
      },
      {
        value: 19,
        label: 'B1',
      },
      {
        value: 21,
        label: 'B2',
      },
      {
        value: 23,
        label: 'B3',
      },
      {
        value: 25,
        label: 'B4',
      },
      {
        value: 27,
        label: 'B5',
      },
      {
        value: 29,
        label: 'B6',
      },
      {
        value: 31,
        label: 'B7',
      },
      {
        value: 34,
        label: '非常',
      },
      {
        value: 37,
        label: '抜取',
      },
    ],
    maxValue: 37,
    nValue: 16,
    stepRangeList: [[0, 37]],
  }
}

function createUIKeiseiAESeriesMasterController(): UIOneHandleMasterControllerConfig {
  return {
    steps: [
      9,
      12,
      15,
      18,
      20,
      22,
      24,
      26,
      29,
    ],
    marks: [
      {
        value: 9,
        label: '50K',
      },
      {
        value: 12,
        label: 'ON',
      },
      {
        value: 15,
        label: 'N',
      },
      {
        value: 18,
        label: 'B1',
      },
      {
        value: 20,
        label: 'B2',
      },
      {
        value: 22,
        label: 'B3',
      },
      {
        value: 24,
        label: 'B4',
      },
      {
        value: 26,
        label: 'B5',
      },
      {
        value: 29,
        label: 'E',
      },
    ],
    maxValue: 29,
    nValue: 15,
    stepRangeList: [[9, 29]],
  }
}

function createOneHandleMasterController(uiOptionsIndex: number): OneHandleMasterController {
  return {
    uiOptionsIndex,
    value: trainsState.uiOneHandleMasterControllerConfigs[uiOptionsIndex].maxValue,
  }
}

function createTestTwoAxlesCar(projectedLine: ProjectedLine, length = 0, uiMasterControllerOptionsIndex: number): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2

  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length },
        [
          distanceBetweenBogiesHalf,
          -distanceBetweenBogiesHalf,
        ],
        [createOneHandleMasterController(uiMasterControllerOptionsIndex)],
      ),
    ],
  )
}

function createTestTwoAxlesCarWithBogies(projectedLine: ProjectedLine, length = 0): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2

  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length + distanceBetweenBogiesHalf },
        [
          0,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - distanceBetweenBogiesHalf },
        [
          0,
        ],
      ),
    ],
    [
      createCarBody(),
    ],
    [
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, 0, distanceBetweenBogiesHalf),
        bogieIndex: 0,
        bogiePosition: new THREE.Vector3(0, 1),
      },
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, 0, -distanceBetweenBogiesHalf),
        bogieIndex: 1,
        bogiePosition: new THREE.Vector3(0, 1),
      },
    ],
  )
}

function createTestTwoBogiesCar(projectedLine: ProjectedLine, length = 0): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length + distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
    ],
    [
      createCarBody(),
    ],
    [
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
        bogieIndex: 0,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
        bogieIndex: 1,
        bogiePosition: new THREE.Vector3(),
      },
    ],
  )
}

function createTestTwoBogiesTwoCars(projectedLine: ProjectedLine, length = 0): Train {
  const carLengthHalf = 20 / 2
  const couplerLengthHalf = 0.92
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length + carLengthHalf + distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length + carLengthHalf - distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - carLengthHalf + distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - carLengthHalf - distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
    ],
    [
      createCarBody(),
      createCarBody(),
      createCarBody(),
    ],
    [
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
        bogieIndex: 0,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
        bogieIndex: 1,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 1,
        otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
        bogieIndex: 2,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 1,
        otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
        bogieIndex: 3,
        bogiePosition: new THREE.Vector3(),
      },
    ],
    [
      {
        bodyIndexA: 6,
        positionA: new THREE.Vector3(0, 0, couplerLengthHalf),
        bodyIndexB: 4,
        positionB: new THREE.Vector3(0, 0, couplerLengthHalf - carLengthHalf),
      },
      {
        bodyIndexA: 6,
        positionA: new THREE.Vector3(0, 0, -couplerLengthHalf),
        bodyIndexB: 5,
        positionB: new THREE.Vector3(0, 0, carLengthHalf - couplerLengthHalf),
      },
    ],
  )
}

function createTestTwoCarsWithJacobsBogies(projectedLine: ProjectedLine, length = 0): Train {
  const carLengthHalf = 20 / 2
  const couplerLengthHalf = 0.92
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length + carLengthHalf + distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - carLengthHalf - distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
    ],
    [
      createCarBody(),
      createCarBody(),
    ],
    [
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
        bogieIndex: 0,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, couplerLengthHalf - carLengthHalf),
        bogieIndex: 1,
        bogiePosition: new THREE.Vector3(0, 0, couplerLengthHalf),
      },
      {
        otherBodyIndex: 1,
        otherBodyPosition: new THREE.Vector3(0, -1, carLengthHalf - couplerLengthHalf),
        bogieIndex: 1,
        bogiePosition: new THREE.Vector3(0, 0, -couplerLengthHalf),
      },
      {
        otherBodyIndex: 1,
        otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
        bogieIndex: 2,
        bogiePosition: new THREE.Vector3(),
      },
    ],
  )
}

function createTestMalletLocomotive(projectedLine: ProjectedLine, length = 0): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length + distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - distanceBetweenBogiesHalf },
        [
          wheelbaseHalf,
          -wheelbaseHalf,
        ],
      ),
    ],
    [
    ],
    [
    ],
    [
      {
        bodyIndexA: 0,
        positionA: new THREE.Vector3(0, 0, -distanceBetweenBogiesHalf),
        bodyIndexB: 1,
        positionB: new THREE.Vector3(0, 0, distanceBetweenBogiesHalf),
      },
    ],
  )
}

function createTestShikiSeries700(projectedLine: ProjectedLine, length = 0): Train {
  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length + 12.6 + 1.6 + 4.07 + 2.61 },
        [
          0.64 + 1.2,
          0.64,
          -0.56,
          -0.56 - 1.2,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length + 12.6 + 1.6 + 4.07 - 2.55 },
        [
          0.6 + 1.2,
          0.6,
          -0.6,
          -0.6 - 1.2,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length + 12.6 + 1.6 - 5.48 + 0.8 + 1.2 },
        [
          1.2,
          0,
          -1.2,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length + 12.6 + 1.6 - 5.48 - 0.8 - 1.2 },
        [
          1.2,
          0,
          -1.2,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - 12.6 - 1.6 + 5.48 + 0.8 + 1.2 },
        [
          1.2,
          0,
          -1.2,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - 12.6 - 1.6 + 5.48 - 0.8 - 1.2 },
        [
          1.2,
          0,
          -1.2,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - 12.6 - 1.6 - 4.07 + 2.55 },
        [
          0.6 + 1.2,
          0.6,
          -0.6,
          -0.6 - 1.2,
        ],
      ),
      createBogie(
        { projectedLine: projectedLine, length: length - 12.6 - 1.6 - 4.07 - 2.61 },
        [
          0.56 + 1.2,
          0.56,
          -0.64,
          -0.64 - 1.2,
        ],
      ),
    ],
    [
      createCarBody(),
      createCarBody(),
      createCarBody(),
      createCarBody(),
      createCarBody(),
      createCarBody(),
      createCarBody(),
    ],
    [
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, 2.6),
        bogieIndex: 0,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, -2.55),
        bogieIndex: 1,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 1,
        otherBodyPosition: new THREE.Vector3(0, -1, 0.8 + 1.2),
        bogieIndex: 2,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 1,
        otherBodyPosition: new THREE.Vector3(0, -1, -0.8 - 1.2),
        bogieIndex: 3,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 2,
        otherBodyPosition: new THREE.Vector3(0, -1, 0.8 + 1.2),
        bogieIndex: 4,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 2,
        otherBodyPosition: new THREE.Vector3(0, -1, -0.8 - 1.2),
        bogieIndex: 5,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 3,
        otherBodyPosition: new THREE.Vector3(0, -1, 2.55),
        bogieIndex: 6,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: 3,
        otherBodyPosition: new THREE.Vector3(0, -1, -2.61),
        bogieIndex: 7,
        bogiePosition: new THREE.Vector3(),
      },
    ],
    [
      {
        bodyIndexA: 8,
        positionA: new THREE.Vector3(),
        bodyIndexB: 12,
        positionB: new THREE.Vector3(0, 0, 1.6 + 4.07),
      },
      {
        bodyIndexA: 9,
        positionA: new THREE.Vector3(),
        bodyIndexB: 12,
        positionB: new THREE.Vector3(0, 0, 1.6 - 5.48),
      },
      {
        bodyIndexA: 10,
        positionA: new THREE.Vector3(),
        bodyIndexB: 13,
        positionB: new THREE.Vector3(0, 0, -1.6 + 5.48),
      },
      {
        bodyIndexA: 11,
        positionA: new THREE.Vector3(),
        bodyIndexB: 13,
        positionB: new THREE.Vector3(0, 0, -1.6 - 4.07),
      },
      {
        bodyIndexA: 12,
        positionA: new THREE.Vector3(),
        bodyIndexB: 14,
        positionB: new THREE.Vector3(0, 0, 12.6),
      },
      {
        bodyIndexA: 13,
        positionA: new THREE.Vector3(),
        bodyIndexB: 14,
        positionB: new THREE.Vector3(0, 0, -12.6),
      },
    ],
  )
}

export default function TestFeatureCollection() {
  React.useEffect(() => {
    const featureCollection_: FeatureCollection = featureCollection
    featureCollectionsState.featureCollections = addNewIdArray([{ value: featureCollection_ }])
    tracksState.projectedLines = addNewIdArray(getProjectedLines(featureCollection_))

    // Loop line test
    const points = []
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
    tracksState.projectedLines[1].points = points

    trainsState.uiOneHandleMasterControllerConfigs = [
      createUIOneHandleMasterControllerConfig(),
    ];

    trainsState.trains = addNewIdArray([
      createTestTwoAxlesCar(tracksState.projectedLines[1], 0, 0),
      createTestTwoAxlesCar(tracksState.projectedLines[1], 100, 0),
      //createTestTwoAxlesCarWithBogies(tracksState.projectedLines[1]),
      //createTestTwoBogiesCar(tracksState.projectedLines[1]),
      //createTestTwoBogiesCar(tracksState.projectedLines[1], 100),
      //createTestTwoBogiesTwoCars(tracksState.projectedLines[1]),
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
