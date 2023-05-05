import * as React from 'react'
import * as THREE from 'three'
import { FeatureCollection } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import featureCollection from '@/data/sakurajosui.geojson'
import { coordinateToEuler, getProjectedLines, ProjectedLine, ProjectedLineAndLength, state as gisState } from '@/lib/gis'
import { addNewIdArray } from '@/lib/saveData'
import { Axle, BodySupporterJoint, Bogie, CarBody, Joint, rollAxles, state as trainsState, Train, getFromPosition, rotateBody } from '@/lib/trains'
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

  train.bogies.forEach((fromBogie, fromBogieIndex) => {
    let fromJointZ = 0
    let toJointZ = 0
    let fromJointIndex = -1
    let toJointIndex = -1

    train.bodySupporterJoints.forEach((joint, jointIndex) => {
      if (fromBogieIndex === joint.bogieIndex) {
        if (fromJointIndex === -1 || joint.bogiePosition.z < fromJointZ) {
          fromJointZ = joint.bogiePosition.z
          fromJointIndex = jointIndex
        }
        if (toJointIndex === -1 || toJointZ < joint.bogiePosition.z) {
          toJointZ = joint.bogiePosition.z
          toJointIndex = jointIndex
        }
      }
    })

    train.fromJointIndexes[fromBogieIndex] = fromJointIndex
    train.toJointIndexes[fromBogieIndex] = toJointIndex
  })
  train.otherBodies.forEach((fromBody, fromOtherBodyIndex) => {
    let fromJointZ = 0
    let toJointZ = 0
    let fromJointIndex = -1
    let toJointIndex = -1

    train.bodySupporterJoints.forEach((joint, jointIndex) => {
      if (fromOtherBodyIndex === joint.otherBodyIndex) {
        if (fromJointIndex === -1 || joint.otherBodyPosition.z < fromJointZ) {
          fromJointZ = joint.otherBodyPosition.z
          fromJointIndex = jointIndex
        }
        if (toJointIndex === -1 || toJointZ < joint.otherBodyPosition.z) {
          toJointZ = joint.otherBodyPosition.z
          toJointIndex = jointIndex
        }
      }
    })
    const fromBodyIndex = fromOtherBodyIndex + train.bogies.length
    train.otherJoints.forEach((joint, otherJointIndex) => {
      if (fromBodyIndex === joint.bodyIndexA) {
        if (fromJointIndex === -1 || joint.positionA.z < fromJointZ) {
          fromJointZ = joint.positionA.z
          fromJointIndex = train.bodySupporterJoints.length + otherJointIndex
        }
        if (toJointIndex === -1 || toJointZ < joint.positionA.z) {
          toJointZ = joint.positionA.z
          toJointIndex = train.bodySupporterJoints.length + otherJointIndex
        }
      } else if (fromBodyIndex === joint.bodyIndexB) {
        if (fromJointIndex === -1 || joint.positionB.z < fromJointZ) {
          fromJointZ = joint.positionB.z
          fromJointIndex = train.bodySupporterJoints.length + otherJointIndex
        }
        if (toJointIndex === -1 || toJointZ < joint.positionB.z) {
          toJointZ = joint.positionB.z
          toJointIndex = train.bodySupporterJoints.length + otherJointIndex
        }
      }
    })

    train.fromJointIndexes[train.bogies.length + fromOtherBodyIndex] = fromJointIndex
    train.toJointIndexes[train.bogies.length + fromOtherBodyIndex] = toJointIndex
  })

  train.otherBodies.forEach((fromBody, fromOtherBodyIndex) => {
    const position = new THREE.Vector3()
    let jointCount = 0

    train.bodySupporterJoints.forEach(joint => {
      if (fromOtherBodyIndex === joint.otherBodyIndex) {
        position.add(getFromPosition(
          fromBody,
          train.bogies[joint.bogieIndex],
          joint.otherBodyPosition,
          joint.bogiePosition
        ))

        //rotateBody(fromBody, train.bogies[joint.bogieIndex], joint.otherBodyPosition, joint.bogiePosition)

        jointCount++
      }
    })

    if (jointCount)
      fromBody.position.copy(position.divideScalar(jointCount))
  })

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

export default function TestFeatureCollection() {
  React.useEffect(() => {
    const featureCollection_: FeatureCollection = featureCollection
    featureCollectionsState.featureCollections = addNewIdArray([{ value: featureCollection_ }])
    tracksState.projectedLines = addNewIdArray(getProjectedLines(featureCollection_))

    trainsState.trains = addNewIdArray([
      //createTestTwoAxlesCar(tracksState.projectedLines[1]),
      //createTestTwoAxlesCarWithBogies(tracksState.projectedLines[1]),
      createTestTwoBogiesCar(tracksState.projectedLines[1]),
      //createTestTwoBogiesTwoCars(tracksState.projectedLines[1]),
    ])

    gisState.originTransform.quaternion.copy(new THREE.Quaternion().setFromEuler(coordinateToEuler(
      pointOnFeature(featureCollection_).geometry.coordinates
    )))
  }, [])

  useFrame(({ }, delta) => {
    trainsState.trains.forEach(train =>
      rollAxles(train, delta * 10)
    )
  })

  return null
}
