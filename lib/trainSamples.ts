import * as THREE from 'three'
import { ProjectedLineAndLength } from './gis'
import { BodySupporterJoint, Bogie, CarBody, Joint, Train, UIOneHandleMasterControllerConfig, OneHandleMasterController, createTrain } from './trains'
import { GameStateType } from './game'

// Commons

export function createCarBody(
  pointOnTrack: ProjectedLineAndLength, // 列車を設置するときにOtherBodiesを同期する前のCarBodyを設置する線路上の位置。Jointの向きが逆にならないようにするために必要
  weight = 0,
  masterControllers: OneHandleMasterController[] = [],
): CarBody {
  return {
    pointOnTrack,
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    weight,
    masterControllers,
  }
}

export function createBogie(
  pointOnTrack: ProjectedLineAndLength,
  axles: {
    z: number,
    diameter: number,
    hasMotor: boolean,
  }[],
  weight = 0,
  masterControllers: OneHandleMasterController[] = [],
): Bogie {
  return {
    ...createCarBody(
      pointOnTrack,
      weight,
      masterControllers,
    ),
    axles: axles.map(({ z, diameter, hasMotor }) => ({
      pointOnTrack: { projectedLineId: pointOnTrack.projectedLineId, length: pointOnTrack.length + z },
      z,
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      diameter,
      rotationX: 0,
      hasMotor,
    })),
  }
}

// One handle master controller

export function createUISotetsu20000SeriesMasterControllerConfig(): UIOneHandleMasterControllerConfig {
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

export function createUIKeiseiAESeriesMasterControllerConfig(): UIOneHandleMasterControllerConfig {
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

export function createOneHandleMasterController(gameState: GameStateType, uiOptionId: string): OneHandleMasterController {
  return {
    uiOptionId,
    value: gameState.uiOneHandleMasterControllerConfigs[uiOptionId].maxValue,
  }
}

// Trains

export function createTestTwoAxlesCar(gameState: GameStateType, projectedLineId: string, length = 0, uiMasterControllerOptionId: string): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2

  return createTrain(gameState,
    [
      createBogie(
        { projectedLineId, length: length },
        [
          { z: distanceBetweenBogiesHalf, diameter: 0.86, hasMotor: true },
          { z: -distanceBetweenBogiesHalf, diameter: 0.86, hasMotor: true },
        ],
        30,
        [createOneHandleMasterController(gameState, uiMasterControllerOptionId)],
      ),
    ],
  )
}

export function createTestTwoAxlesCarWithBogies(gameState: GameStateType, projectedLineId: string, length = 0): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2

  return createTrain(gameState,
    [
      createBogie(
        { projectedLineId, length: length + distanceBetweenBogiesHalf },
        [
          { z: 0, diameter: 0.86, hasMotor: true },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - distanceBetweenBogiesHalf },
        [
          { z: 0, diameter: 0.86, hasMotor: true },
        ],
      ),
    ],
    [
      createCarBody({ projectedLineId, length: length }),
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

export function createTestTwoBogiesCar(gameState: GameStateType, projectedLineId: string, length = 0): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(gameState,
    [
      createBogie(
        { projectedLineId, length: length + distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
    ],
    [
      createCarBody({ projectedLineId, length: length }),
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

export function createTestTwoBogiesTwoCars(gameState: GameStateType, projectedLineId: string, length = 0): Train {
  const carLengthHalf = 20 / 2
  const couplerLengthHalf = 0.92
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(gameState,
    [
      createBogie(
        { projectedLineId, length: length + carLengthHalf + distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
      createBogie(
        { projectedLineId, length: length + carLengthHalf - distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - carLengthHalf + distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - carLengthHalf - distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
    ],
    [
      createCarBody({ projectedLineId, length: length + carLengthHalf }),
      createCarBody({ projectedLineId, length: length - carLengthHalf }),
      createCarBody({ projectedLineId, length: length }),
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

export function createJNR103Series(gameState: GameStateType, projectedLineId: string, length = 0, uiMasterControllerOptionId: string): Train {
  const carLength = 20
  const couplerLengthHalf = 0.92
  const distanceBetweenBogiesHalf = 13.8 / 2

  const wheelbaseHalfM = 2.3 / 2
  const wheelbaseHalfT = 2.1 / 2

  const axleDiameterM = 0.91
  const axleDiameterT = 0.86

  const massKuha = 30.6
  const massMoha102 = 40.2
  const massMoha103 = 39.7
  const massSaha = 28.8

  const bogies: Bogie[] = []
  const otherBodies: CarBody[] = []
  const bodySupporterJoints: BodySupporterJoint[] = []
  const otherJoints: Joint[] = []

  const cars = [
    0, // Kuha
    1, // Moha 102
    2, // Moha 103
    3, // Saha
    1,
    2,
    3,
    1,
    2,
    0,
  ]

  let trainWeight = 0
  let motorCars = 0

  cars.forEach((type, index) => {
    const hasMotor = type === 1 || type === 2
    const length_ = length + carLength * (cars.length - 1) / 2 - carLength * index
    const wheelbaseHalf = hasMotor ? wheelbaseHalfM : wheelbaseHalfT

    bogies.push(
      createBogie(
        { projectedLineId, length: length_ + distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: hasMotor ? axleDiameterM : axleDiameterT, hasMotor },
          { z: -wheelbaseHalf, diameter: hasMotor ? axleDiameterM : axleDiameterT, hasMotor },
        ],
      ),
      createBogie(
        { projectedLineId, length: length_ - distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: hasMotor ? axleDiameterM : axleDiameterT, hasMotor },
          { z: -wheelbaseHalf, diameter: hasMotor ? axleDiameterM : axleDiameterT, hasMotor },
        ],
      )
    )

    const carWeight = type === 0 ? massKuha :
      type === 1 ? massMoha102 :
        type === 2 ? massMoha103 :
          massSaha
    trainWeight += carWeight

    if (hasMotor)
      motorCars += 1

    otherBodies.push(createCarBody(
      { projectedLineId, length: length_ },
      carWeight,
      index === 0 || index === cars.length - 1 ? [createOneHandleMasterController(gameState, uiMasterControllerOptionId)] : [],
    ))

    bodySupporterJoints.push(
      {
        otherBodyIndex: index,
        otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
        bogieIndex: index * 2,
        bogiePosition: new THREE.Vector3(),
      },
      {
        otherBodyIndex: index,
        otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
        bogieIndex: index * 2 + 1,
        bogiePosition: new THREE.Vector3(),
      },
    )
  })
  for (let i = 0; i <= cars.length - 2; i++) {
    otherBodies.push(createCarBody(
      { projectedLineId, length: length + carLength * (cars.length - 1) / 2 - carLength * i - carLength / 2 }
    ))

    otherJoints.push(
      {
        bodyIndexA: bogies.length + cars.length + i,
        positionA: new THREE.Vector3(0, 0, couplerLengthHalf),
        bodyIndexB: bogies.length + i,
        positionB: new THREE.Vector3(0, 0, couplerLengthHalf - carLength / 2),
      },
      {
        bodyIndexA: bogies.length + cars.length + i,
        positionA: new THREE.Vector3(0, 0, -couplerLengthHalf),
        bodyIndexB: bogies.length + i + 1,
        positionB: new THREE.Vector3(0, 0, carLength / 2 - couplerLengthHalf),
      },
    )
  }

  return createTrain(
    gameState,
    bogies,
    otherBodies,
    bodySupporterJoints,
    otherJoints,
    0,
    trainWeight,
    motorCars,
  )
}

export function createTestTwoCarsWithJacobsBogies(gameState: GameStateType, projectedLineId: string, length = 0): Train {
  const carLengthHalf = 20 / 2
  const couplerLengthHalf = 0.92
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(gameState,
    [
      createBogie(
        { projectedLineId, length: length + carLengthHalf + distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
      createBogie(
        { projectedLineId, length: length },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - carLengthHalf - distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        ],
      ),
    ],
    [
      createCarBody({ projectedLineId, length: length + carLengthHalf }),
      createCarBody({ projectedLineId, length: length - carLengthHalf }),
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

export function createTestMalletLocomotive(gameState: GameStateType, projectedLineId: string, length = 0): Train {
  const distanceBetweenBogiesHalf = 13.8 / 2
  const wheelbaseHalf = 2.1 / 2

  return createTrain(gameState,
    [
      createBogie(
        { projectedLineId, length: length + distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: false },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - distanceBetweenBogiesHalf },
        [
          { z: wheelbaseHalf, diameter: 0.86, hasMotor: false },
          { z: -wheelbaseHalf, diameter: 0.86, hasMotor: false },
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

export function createTestShikiSeries700(gameState: GameStateType, projectedLineId: string, length = 0): Train {
  return createTrain(gameState,
    [
      createBogie(
        { projectedLineId, length: length + 12.6 + 1.6 + 4.07 + 2.61 },
        [
          { z: 0.64 + 1.2, diameter: 0.86, hasMotor: false },
          { z: 0.64, diameter: 0.86, hasMotor: false },
          { z: -0.56, diameter: 0.86, hasMotor: false },
          { z: -0.56 - 1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length + 12.6 + 1.6 + 4.07 - 2.55 },
        [
          { z: 0.6 + 1.2, diameter: 0.86, hasMotor: false },
          { z: 0.6, diameter: 0.86, hasMotor: false },
          { z: -0.6, diameter: 0.86, hasMotor: false },
          { z: -0.6 - 1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length + 12.6 + 1.6 - 5.48 + 0.8 + 1.2 },
        [
          { z: 1.2, diameter: 0.86, hasMotor: false },
          { z: 0, diameter: 0.86, hasMotor: false },
          { z: -1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length + 12.6 + 1.6 - 5.48 - 0.8 - 1.2 },
        [
          { z: 1.2, diameter: 0.86, hasMotor: false },
          { z: 0, diameter: 0.86, hasMotor: false },
          { z: -1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - 12.6 - 1.6 + 5.48 + 0.8 + 1.2 },
        [
          { z: 1.2, diameter: 0.86, hasMotor: false },
          { z: 0, diameter: 0.86, hasMotor: false },
          { z: -1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - 12.6 - 1.6 + 5.48 - 0.8 - 1.2 },
        [
          { z: 1.2, diameter: 0.86, hasMotor: false },
          { z: 0, diameter: 0.86, hasMotor: false },
          { z: -1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - 12.6 - 1.6 - 4.07 + 2.55 },
        [
          { z: 0.6 + 1.2, diameter: 0.86, hasMotor: false },
          { z: 0.6, diameter: 0.86, hasMotor: false },
          { z: -0.6, diameter: 0.86, hasMotor: false },
          { z: -0.6 - 1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
      createBogie(
        { projectedLineId, length: length - 12.6 - 1.6 - 4.07 - 2.61 },
        [
          { z: 0.56 + 1.2, diameter: 0.86, hasMotor: false },
          { z: 0.56, diameter: 0.86, hasMotor: false },
          { z: -0.64, diameter: 0.86, hasMotor: false },
          { z: -0.64 - 1.2, diameter: 0.86, hasMotor: false },
        ],
      ),
    ],
    [
      createCarBody({ projectedLineId, length: length + 12.6 + 1.6 + 4.07 }),
      createCarBody({ projectedLineId, length: length + 12.6 + 1.6 - 5.48 }),
      createCarBody({ projectedLineId, length: length - 12.6 - 1.6 + 5.48 }),
      createCarBody({ projectedLineId, length: length - 12.6 - 1.6 - 4.07 }),
      createCarBody({ projectedLineId, length: length + 12.6 + 1.6 }),
      createCarBody({ projectedLineId, length: length + 12.6 + 1.6 }),
      createCarBody({ projectedLineId, length: length }),
    ],
    [
      {
        otherBodyIndex: 0,
        otherBodyPosition: new THREE.Vector3(0, -1, 2.61),
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
