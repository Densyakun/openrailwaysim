import * as React from 'react'
import * as THREE from 'three'
import { FeatureCollection } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import featureCollection from '@/data/sakurajosui.geojson'
import { coordinateToEuler, getProjectedLines, ProjectedLine, ProjectedLineAndLength, state as gisState } from '@/lib/gis'
import { addNewIdArray } from '@/lib/saveData'
import { Axle, BodySupporterJoint, Bogie, CarBody, Joint, rollAxles, state as trainsState, Train, getFromPosition, rotateBody, syncOtherBodies, calcJointsToRotateBody, placeTrain } from '@/lib/trains'
import { state as featureCollectionsState } from './FeatureCollections'
import { state as tracksState } from './Tracks'
import { useFrame } from '@react-three/fiber'

function createCarBody(): CarBody {
  return {
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
  }
}

function createBogie({ projectedLine, length }: ProjectedLineAndLength, axlesZ: number[]): Bogie {
  return {
    ...createCarBody(),
    axles: axlesZ.map(z => ({
      pointOnTrack: { projectedLine: projectedLine, length: length + z },
      z,
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
    })),
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
    position: {
      euler: getGlobalEulerOfFirstAxle(bogies[0].axles[0]),
      elevation: 0,
    },
  }

  calcJointsToRotateBody(train)

  // 連結器の向きを反転させないため
  placeTrain(train)

  return train
}

function createTestTwoAxlesCar(projectedLine: ProjectedLine, length = 0): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2

  return createTrain(
    [
      createBogie(
        { projectedLine: projectedLine, length: length },
        [
          distanceBetweenBogiesHalf,
          -distanceBetweenBogiesHalf,
        ],
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

    trainsState.trains = addNewIdArray([
      //createTestTwoAxlesCar(tracksState.projectedLines[1]),
      //createTestTwoAxlesCarWithBogies(tracksState.projectedLines[1]),
      //createTestTwoBogiesCar(tracksState.projectedLines[1]),
      //createTestTwoBogiesTwoCars(tracksState.projectedLines[1]),
      createTestTwoCarsWithJacobsBogies(tracksState.projectedLines[1]),
    ])

    gisState.originTransform.quaternion.copy(new THREE.Quaternion().setFromEuler(coordinateToEuler(
      //pointOnFeature(featureCollection_).geometry.coordinates
      tracksState.projectedLines[1].centerCoordinate
    )))
  }, [])

  useFrame(({ }, delta) => {
    trainsState.trains.forEach(train =>
      rollAxles(train, delta * 10)
    )
  })

  return null
}
