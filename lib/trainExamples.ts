import * as THREE from 'three'
import { BogieFormat, TrainFormat, UIOneHandleMasterControllerConfig } from './trains'

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

// Trains

const couplerLengthHalf = 0.92;
const carLengthHalf = 20 / 2;
const distanceBetweenBogiesHalf = 13.8 / 2;
const wheelbaseHalf = 2.1 / 2;
const oneHandleMasterControllerUIConfigId = "oneHandleMasterControllerUIConfigId";

export const oneAxleTestCar: TrainFormat = {
  bogies: [
    {
      offset: 0,
      axles: [
        { z: 0, diameter: 0.86, hasMotor: true },
      ],
      weight: 30,
    }
  ],
  otherBodyOffsets: [],
  otherBodyWeights: [],
  cabFormats: [
    {
      directionIsReversed: false,
      oneHandleMasterControllerUIConfigId,
    },
  ],
  bodySupporterJoints: [
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, 0, 0),
      bogieIndex: 0,
      bogiePosition: new THREE.Vector3(0, 1),
    },
  ],
  otherJoints: [],
};

export const twoAxlesTestCar: TrainFormat = {
  bogies: [
    {
      offset: 0,
      axles: [
        { z: -distanceBetweenBogiesHalf, diameter: 0.86, hasMotor: true },
        { z: distanceBetweenBogiesHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 30,
    }
  ],
  otherBodyOffsets: [],
  otherBodyWeights: [],
  cabFormats: [
    {
      directionIsReversed: false,
      oneHandleMasterControllerUIConfigId,
    },
  ],
  bodySupporterJoints: [
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, 0, 0),
      bogieIndex: 0,
      bogiePosition: new THREE.Vector3(0, 1),
    },
  ],
  otherJoints: [],
};

export const twoAxlesTestCarWithBogies: TrainFormat = {
  bogies: [
    {
      offset: -distanceBetweenBogiesHalf,
      axles: [
        { z: 0, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
    {
      offset: distanceBetweenBogiesHalf,
      axles: [
        { z: 0, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
  ],
  otherBodyOffsets: [
    0,
  ],
  otherBodyWeights: [
    0,
  ],
  cabFormats: [
    {
      directionIsReversed: false,
      oneHandleMasterControllerUIConfigId,
    },
  ],
  bodySupporterJoints: [
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, 0, -distanceBetweenBogiesHalf),
      bogieIndex: 0,
      bogiePosition: new THREE.Vector3(0, 1),
    },
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, 0, distanceBetweenBogiesHalf),
      bogieIndex: 1,
      bogiePosition: new THREE.Vector3(0, 1),
    },
  ],
  otherJoints: [],
};

export const twoBogiesTestCar: TrainFormat = {
  bogies: [
    {
      offset: -distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
    {
      offset: distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
  ],
  otherBodyOffsets: [
    0,
  ],
  otherBodyWeights: [
    0,
  ],
  cabFormats: [
    {
      directionIsReversed: false,
      oneHandleMasterControllerUIConfigId,
    },
  ],
  bodySupporterJoints: [
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, 0, -distanceBetweenBogiesHalf),
      bogieIndex: 0,
      bogiePosition: new THREE.Vector3(0, 1),
    },
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, 0, distanceBetweenBogiesHalf),
      bogieIndex: 1,
      bogiePosition: new THREE.Vector3(0, 1),
    },
  ],
  otherJoints: [],
};

export const twoBogiesTwoTestCars: TrainFormat = {
  bogies: [
    {
      offset: -carLengthHalf - distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
    {
      offset: -carLengthHalf + distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
    {
      offset: carLengthHalf - distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
    {
      offset: carLengthHalf + distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 20,
    },
  ],
  otherBodyOffsets: [
    -carLengthHalf,
    carLengthHalf,
    0,
  ],
  otherBodyWeights: [
    0,
    0,
    0,
  ],
  cabFormats: [
    {
      directionIsReversed: true,
      oneHandleMasterControllerUIConfigId,
    },
    {
      directionIsReversed: false,
      oneHandleMasterControllerUIConfigId,
    },
    null,
  ],
  bodySupporterJoints: [
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
      bogieIndex: 0,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
      bogieIndex: 1,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 1,
      otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
      bogieIndex: 2,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 1,
      otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
      bogieIndex: 3,
      bogiePosition: new THREE.Vector3(),
    },
  ],
  otherJoints: [
    {
      bodyIndexA: 4,
      positionA: new THREE.Vector3(0, 0, carLengthHalf - couplerLengthHalf),
      bodyIndexB: 6,
      positionB: new THREE.Vector3(0, 0, -couplerLengthHalf),
    },
    {
      bodyIndexA: 5,
      positionA: new THREE.Vector3(0, 0, couplerLengthHalf - carLengthHalf),
      bodyIndexB: 6,
      positionB: new THREE.Vector3(0, 0, couplerLengthHalf),
    },
  ],
};

export type StandardCarFormat = {
  carLength: number;
  bogies: BogieFormat[];
  carWeight: number;
  /**
   * 正の値
   */
  couplerJointOffset: number;
  /**
   * 正の値
   */
  couplerJointOffset1: number;
};

export function createStandardTrainFormat(carFormats: StandardCarFormat[], carFormatIndexes: number[], masterControllerUIOptionId: string): TrainFormat {
  const trainFormat: TrainFormat = {
    bogies: [],
    otherBodyOffsets: [],
    otherBodyWeights: [],
    cabFormats: [],
    bodySupporterJoints: [],
    otherJoints: [],
  };

  let length = carFormats.reduce((accumulator, carFormat) => accumulator + carFormat.carLength, 0) / -2;
  const carCenters: number[] = [];

  carFormatIndexes.forEach((carFormatIndex, index) => {
    const carFormat = carFormats[carFormatIndex];

    const carCenter = length + carFormat.carLength / 2;
    carCenters.push(carCenter);

    // 車体を追加
    trainFormat.otherBodyOffsets.push(carCenter);
    trainFormat.otherBodyWeights.push(carFormat.carWeight);
    trainFormat.cabFormats.push(
      index === 0
        ? {
          directionIsReversed: true,
          oneHandleMasterControllerUIConfigId: masterControllerUIOptionId,
        }
        : index === carFormatIndexes.length - 1
          ? {
            directionIsReversed: false,
            oneHandleMasterControllerUIConfigId: masterControllerUIOptionId,
          }
          : null
    );

    // 台車を追加
    carFormat.bogies.forEach(bogie => {
      trainFormat.bogies.push({
        offset: carCenter + bogie.offset,
        axles: bogie.axles.map(({ z, diameter, hasMotor }) => (
          { z, diameter, hasMotor }
        )),
        weight: 0,
      });

      // 車体支持装置を追加
      trainFormat.bodySupporterJoints.push(
        {
          otherBodyIndex: index,
          otherBodyPosition: new THREE.Vector3(0, -1, -bogie.offset),
          bogieIndex: index * 2,
          bogiePosition: new THREE.Vector3(),
        },
        {
          otherBodyIndex: index,
          otherBodyPosition: new THREE.Vector3(0, -1, bogie.offset),
          bogieIndex: index * 2 + 1,
          bogiePosition: new THREE.Vector3(),
        },
      );
    });

    length += carFormat.carLength;
  })

  // 車両間の連結器を追加
  for (let i = 0; i <= carFormatIndexes.length - 2; i++) {
    const carFormat = carFormats[carFormatIndexes[i]];
    const carFormat1 = carFormats[carFormatIndexes[i + 1]];

    trainFormat.otherBodyOffsets.push(carCenters[i] + carFormat.carLength / 2);
    trainFormat.otherBodyWeights.push(0);
    trainFormat.cabFormats.push(null);

    trainFormat.otherJoints.push(
      {
        bodyIndexA: trainFormat.bogies.length + i,
        positionA: new THREE.Vector3(0, 0, carFormat.carLength / 2 - carFormat.couplerJointOffset),
        bodyIndexB: trainFormat.bogies.length + carFormatIndexes.length + i,
        positionB: new THREE.Vector3(0, 0, -carFormat.couplerJointOffset),
      },
      {
        bodyIndexA: trainFormat.bogies.length + i + 1,
        positionA: new THREE.Vector3(0, 0, carFormat1.couplerJointOffset1 - carFormat1.carLength / 2),
        bodyIndexB: trainFormat.bogies.length + carFormatIndexes.length + i,
        positionB: new THREE.Vector3(0, 0, carFormat1.couplerJointOffset1),
      },
    );

    // TODO 両端の連結器
  }

  return trainFormat;
}

export function convertTrainFormatToStandard(trainFormat: TrainFormat): { carFormats: StandardCarFormat[], carFormatIndexes: number[], masterControllerUIOptionId: string } {
  const { bogies, otherBodyOffsets, otherBodyWeights, cabFormats, bodySupporterJoints, otherJoints } = trainFormat;

  // 車体（bodySupporterJointsで台車と接続されているotherBody）を特定
  const carBodyIndices = Array.from(new Set(bodySupporterJoints.map(j => j.otherBodyIndex))).sort((a, b) => a - b);
  const n = carBodyIndices.length;

  if (n === 0) {
    return { carFormats: [], carFormatIndexes: [], masterControllerUIOptionId: "" };
  }

  const tempCarFormats: StandardCarFormat[] = [];
  let masterControllerUIOptionId = "";

  for (let i = 0; i < n; i++) {
    const carBodyIndex = carBodyIndices[i];
    const carCenter = otherBodyOffsets[carBodyIndex];
    const carWeight = otherBodyWeights[carBodyIndex];

    // この車体に属する台車を抽出
    const carBogieIndices = Array.from(new Set(bodySupporterJoints.filter(j => j.otherBodyIndex === carBodyIndex).map(j => j.bogieIndex))).sort((a, b) => a - b);
    const carBogies: BogieFormat[] = carBogieIndices.map(bi => {
      const b = bogies[bi];
      return {
        offset: b.offset - carCenter,
        axles: b.axles.map(a => ({ ...a })),
        weight: b.weight
      };
    });

    // 車体長と連結器オフセットの推定
    let carLength = 20;
    if (i < n - 1) {
      carLength = otherBodyOffsets[carBodyIndices[i + 1]] - carCenter;
    } else if (i > 0) {
      carLength = carCenter - otherBodyOffsets[carBodyIndices[i - 1]];
    }

    let couplerJointOffset = 0.5;
    let couplerJointOffset1 = 0.5;

    const carJoints = otherJoints.filter(j => j.bodyIndexA === carBodyIndex);
    carJoints.forEach(j => {
      if (j.positionA.z > 0) {
        // 後方連結器
        couplerJointOffset = carLength / 2 - j.positionA.z;
      } else {
        // 前方連結器
        couplerJointOffset1 = j.positionA.z + carLength / 2;
      }
    });

    tempCarFormats.push({
      carLength,
      bogies: carBogies,
      carWeight,
      couplerJointOffset,
      couplerJointOffset1
    });

    if (cabFormats[carBodyIndex]) {
      masterControllerUIOptionId = cabFormats[carBodyIndex]!.oneHandleMasterControllerUIConfigId;
    }
  }

  // テンプレートの重複排除
  const carFormats: StandardCarFormat[] = [];
  const carFormatIndexes: number[] = [];

  tempCarFormats.forEach(tf => {
    const stringified = JSON.stringify(tf);
    let index = carFormats.findIndex(f => JSON.stringify(f) === stringified);
    if (index === -1) {
      index = carFormats.length;
      carFormats.push(tf);
    }
    carFormatIndexes.push(index);
  });

  return { carFormats, carFormatIndexes, masterControllerUIOptionId };
}

export function getJNR103SeriesStandardData(): { carFormats: StandardCarFormat[], carFormatIndexes: number[] } {
  const carLength = 20;
  const couplerLengthHalf = 0.92;
  const distanceBetweenBogiesHalf = 13.8 / 2;
  const wheelbaseHalfM = 2.3 / 2;
  const wheelbaseHalfT = 2.1 / 2;
  const axleDiameterM = 0.91;
  const axleDiameterT = 0.86;

  const bogiesMCar: BogieFormat[] = [
    {
      offset: -distanceBetweenBogiesHalf,
      axles: [{ z: -wheelbaseHalfM, diameter: axleDiameterM, hasMotor: true }, { z: wheelbaseHalfM, diameter: axleDiameterM, hasMotor: true }],
      weight: 0
    },
    {
      offset: distanceBetweenBogiesHalf,
      axles: [{ z: -wheelbaseHalfM, diameter: axleDiameterM, hasMotor: true }, { z: wheelbaseHalfM, diameter: axleDiameterM, hasMotor: true }],
      weight: 0
    }
  ];

  const bogiesTCar: BogieFormat[] = [
    {
      offset: -distanceBetweenBogiesHalf,
      axles: [{ z: -wheelbaseHalfT, diameter: axleDiameterT, hasMotor: false }, { z: wheelbaseHalfT, diameter: axleDiameterT, hasMotor: false }],
      weight: 0
    },
    {
      offset: distanceBetweenBogiesHalf,
      axles: [{ z: -wheelbaseHalfT, diameter: axleDiameterT, hasMotor: false }, { z: wheelbaseHalfT, diameter: axleDiameterT, hasMotor: false }],
      weight: 0
    }
  ];

  const massKuha = 30.6;
  const massMoha102 = 40.2;
  const massMoha103 = 39.7;
  const massSaha = 28.8;

  return {
    carFormats: [
      { carLength, bogies: bogiesTCar, carWeight: massKuha, couplerJointOffset: couplerLengthHalf, couplerJointOffset1: couplerLengthHalf },
      { carLength, bogies: bogiesMCar, carWeight: massMoha102, couplerJointOffset: couplerLengthHalf, couplerJointOffset1: couplerLengthHalf },
      { carLength, bogies: bogiesMCar, carWeight: massMoha103, couplerJointOffset: couplerLengthHalf, couplerJointOffset1: couplerLengthHalf },
      { carLength, bogies: bogiesTCar, carWeight: massSaha, couplerJointOffset: couplerLengthHalf, couplerJointOffset1: couplerLengthHalf },
    ],
    carFormatIndexes: [0, 1, 2, 3, 1, 2, 3, 1, 2, 0]
  };
}

export function createJNR103SeriesTrainFormat(masterControllerUIOptionId: string): TrainFormat {
  const { carFormats, carFormatIndexes } = getJNR103SeriesStandardData();
  return createStandardTrainFormat(carFormats, carFormatIndexes, masterControllerUIOptionId);
}

export const twoTestCarsWithJacobsBogies: TrainFormat = {
  bogies: [
    {
      offset: -carLengthHalf - distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 0,
    },
    {
      offset: 0,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 0,
    },
    {
      offset: carLengthHalf + distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: true },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: true },
      ],
      weight: 0,
    },
  ],
  otherBodyOffsets: [
    -carLengthHalf,
    carLengthHalf,
  ],
  otherBodyWeights: [
    0,
    0,
  ],
  cabFormats: [
    {
      directionIsReversed: true,
      oneHandleMasterControllerUIConfigId,
    },
    {
      directionIsReversed: false,
      oneHandleMasterControllerUIConfigId,
    },
  ],
  bodySupporterJoints: [
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, -1, -distanceBetweenBogiesHalf),
      bogieIndex: 0,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, -1, carLengthHalf - couplerLengthHalf),
      bogieIndex: 1,
      bogiePosition: new THREE.Vector3(0, 0, -couplerLengthHalf),
    },
    {
      otherBodyIndex: 1,
      otherBodyPosition: new THREE.Vector3(0, -1, couplerLengthHalf - carLengthHalf),
      bogieIndex: 1,
      bogiePosition: new THREE.Vector3(0, 0, couplerLengthHalf),
    },
    {
      otherBodyIndex: 1,
      otherBodyPosition: new THREE.Vector3(0, -1, distanceBetweenBogiesHalf),
      bogieIndex: 2,
      bogiePosition: new THREE.Vector3(),
    },
  ],
  otherJoints: [],
};

export const malletLocomotiveTest: TrainFormat = {
  bogies: [
    {
      offset: -distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: false },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: distanceBetweenBogiesHalf,
      axles: [
        { z: -wheelbaseHalf, diameter: 0.86, hasMotor: false },
        { z: wheelbaseHalf, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
  ],
  otherBodyOffsets: [
    -distanceBetweenBogiesHalf,
    distanceBetweenBogiesHalf,
  ],
  otherBodyWeights: [
    0,
    0,
  ],
  cabFormats: [
    {
      directionIsReversed: true,
      oneHandleMasterControllerUIConfigId,
    },
    {
      directionIsReversed: false,
      oneHandleMasterControllerUIConfigId,
    },
  ],
  bodySupporterJoints: [],
  otherJoints: [
    {
      bodyIndexA: 0,
      positionA: new THREE.Vector3(0, 0, distanceBetweenBogiesHalf),
      bodyIndexB: 1,
      positionB: new THREE.Vector3(0, 0, -distanceBetweenBogiesHalf),
    },
  ],
};

export const shikiSeries700Test: TrainFormat = {
  bogies: [
    {
      offset: -12.6 + 1.6 + 4.07 + 2.61,
      axles: [
        { z: -0.64 - 1.2, diameter: 0.86, hasMotor: false },
        { z: -0.64, diameter: 0.86, hasMotor: false },
        { z: 0.56, diameter: 0.86, hasMotor: false },
        { z: 0.56 + 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: -12.6 + 1.6 + 4.07 - 2.55,
      axles: [
        { z: -0.6 - 1.2, diameter: 0.86, hasMotor: false },
        { z: -0.6, diameter: 0.86, hasMotor: false },
        { z: 0.6, diameter: 0.86, hasMotor: false },
        { z: 0.6 + 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: -12.6 + 1.6 - 5.48 + 0.8 + 1.2,
      axles: [
        { z: -1.2, diameter: 0.86, hasMotor: false },
        { z: 0, diameter: 0.86, hasMotor: false },
        { z: 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: -12.6 + 1.6 - 5.48 - 0.8 - 1.2,
      axles: [
        { z: -1.2, diameter: 0.86, hasMotor: false },
        { z: 0, diameter: 0.86, hasMotor: false },
        { z: 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: 12.6 - 1.6 + 5.48 + 0.8 + 1.2,
      axles: [
        { z: -1.2, diameter: 0.86, hasMotor: false },
        { z: 0, diameter: 0.86, hasMotor: false },
        { z: 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: 12.6 - 1.6 + 5.48 - 0.8 - 1.2,
      axles: [
        { z: -1.2, diameter: 0.86, hasMotor: false },
        { z: 0, diameter: 0.86, hasMotor: false },
        { z: 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: 12.6 - 1.6 - 4.07 + 2.55,
      axles: [
        { z: -0.6 - 1.2, diameter: 0.86, hasMotor: false },
        { z: -0.6, diameter: 0.86, hasMotor: false },
        { z: 0.6, diameter: 0.86, hasMotor: false },
        { z: 0.6 + 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
    {
      offset: 12.6 - 1.6 - 4.07 - 2.61,
      axles: [
        { z: -0.56 - 1.2, diameter: 0.86, hasMotor: false },
        { z: -0.56, diameter: 0.86, hasMotor: false },
        { z: 0.64, diameter: 0.86, hasMotor: false },
        { z: 0.64 + 1.2, diameter: 0.86, hasMotor: false },
      ],
      weight: 0,
    },
  ],
  otherBodyOffsets: [
    -12.6 - 1.6 - 4.07,
    -12.6 - 1.6 + 5.48,
    12.6 + 1.6 - 5.48,
    12.6 + 1.6 + 4.07,
    -12.6 - 1.6,
    12.6 + 1.6,
    0,
  ],
  otherBodyWeights: [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ],
  cabFormats: [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  bodySupporterJoints: [
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, -1, -2.61),
      bogieIndex: 0,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 0,
      otherBodyPosition: new THREE.Vector3(0, -1, 2.55),
      bogieIndex: 1,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 1,
      otherBodyPosition: new THREE.Vector3(0, -1, -0.8 - 1.2),
      bogieIndex: 2,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 1,
      otherBodyPosition: new THREE.Vector3(0, -1, 0.8 + 1.2),
      bogieIndex: 3,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 2,
      otherBodyPosition: new THREE.Vector3(0, -1, -0.8 - 1.2),
      bogieIndex: 4,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 2,
      otherBodyPosition: new THREE.Vector3(0, -1, 0.8 + 1.2),
      bogieIndex: 5,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 3,
      otherBodyPosition: new THREE.Vector3(0, -1, -2.55),
      bogieIndex: 6,
      bogiePosition: new THREE.Vector3(),
    },
    {
      otherBodyIndex: 3,
      otherBodyPosition: new THREE.Vector3(0, -1, 2.61),
      bogieIndex: 7,
      bogiePosition: new THREE.Vector3(),
    },
  ],
  otherJoints: [
    {
      bodyIndexA: 8,
      positionA: new THREE.Vector3(),
      bodyIndexB: 12,
      positionB: new THREE.Vector3(0, 0, -1.6 - 4.07),
    },
    {
      bodyIndexA: 9,
      positionA: new THREE.Vector3(),
      bodyIndexB: 12,
      positionB: new THREE.Vector3(0, 0, -1.6 + 5.48),
    },
    {
      bodyIndexA: 10,
      positionA: new THREE.Vector3(),
      bodyIndexB: 13,
      positionB: new THREE.Vector3(0, 0, 1.6 - 5.48),
    },
    {
      bodyIndexA: 11,
      positionA: new THREE.Vector3(),
      bodyIndexB: 13,
      positionB: new THREE.Vector3(0, 0, 1.6 + 4.07),
    },
    {
      bodyIndexA: 12,
      positionA: new THREE.Vector3(),
      bodyIndexB: 14,
      positionB: new THREE.Vector3(0, 0, -12.6),
    },
    {
      bodyIndexA: 13,
      positionA: new THREE.Vector3(),
      bodyIndexB: 14,
      positionB: new THREE.Vector3(0, 0, 12.6),
    },
  ],
};
