import * as THREE from 'three'
import { Feature, LineString, Point, Position } from 'geojson'
import { default as turfBearing } from '@turf/bearing'
import { default as turfDestination } from '@turf/destination'
import { default as turfDistance } from '@turf/distance'
import { point as turfPoint } from '@turf/helpers'
import { proxy } from 'valtio'
import { SaveDataType } from './game'
import booleanEqual from '@turf/boolean-equal'

export const sphericalEarthMeridianLength = turfDistance([0, -90], [0, 90], { units: 'meters' })

export type FeatureAt = {
  featureCollectionId: string;
  featureIndex: number;
  segmentIndex: number;
}

export function equalFeatureAt(featureAt: FeatureAt, featureAt1: FeatureAt) {
  return featureAt.featureCollectionId === featureAt1.featureCollectionId
    && featureAt.featureIndex === featureAt1.featureIndex
    && featureAt.segmentIndex === featureAt1.segmentIndex;
}

export const gisState = proxy<{
  hoveredFeatures: FeatureAt[];
  selectedFeatures: FeatureAt[];
}>({
  hoveredFeatures: [],
  selectedFeatures: [],
})

export function move(pointQuaternion: THREE.Quaternion, moveX: number, moveZ: number) {
  const distance = Math.sqrt(moveX ** 2 + moveZ ** 2)
    * (sphericalEarthMeridianLength / ((sphericalEarthMeridianLength / Math.PI) * Math.PI))
  const bearing = Math.atan2(-moveZ, moveX) * -180 / Math.PI + 90
  const destination = turfDestination(turfPoint([0, 0]), distance, bearing, { units: 'meters' })

  return pointQuaternion.multiply(
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        destination.geometry.coordinates[1] * Math.PI / -180,
        destination.geometry.coordinates[0] * Math.PI / 180,
        0,
        'YXZ'
      )
    )
  )
}

export function eulerToCoordinate(euler: THREE.Euler): Position {
  return [euler.y * 180 / Math.PI, euler.x * -180 / Math.PI]
}

export function coordinateToEuler(coordinate: Position): THREE.Euler {
  return new THREE.Euler(coordinate[1] * Math.PI / -180, coordinate[0] * Math.PI / 180, 0, 'YXZ')
}

export function getRotation(coordinate: Position, originCoordinate: Position) {
  return new THREE.Euler(0, getMeridianAngle(coordinate, originCoordinate), 0, 'YXZ')
}

export function getBearing(coordinate: Position, originCoordinate: Position) {
  return (turfBearing(originCoordinate, coordinate) - 90) * Math.PI / -180
}

export function getRelativePosition(coordinate: Position, originCoordinate: Position) {
  // Azimuthal equidistant projection
  const distance = turfDistance(originCoordinate, coordinate, { units: 'meters' })

  const angle = getBearing(coordinate, originCoordinate)

  return new THREE.Vector3(
    Math.cos(angle) * distance,
    0,
    Math.sin(-angle) * distance
  )
}

export function getMeridianAngle(coordinate: Position, originCoordinate: Position) {
  const vector = getRelativePosition([coordinate[0], coordinate[1] + 0.04], originCoordinate)
    .sub(getRelativePosition(coordinate, originCoordinate))

  return Math.atan2(-vector.x, -vector.z)
}

export function getCoordinateText(coordinate: Position) {
  return `${coordinate[0].toFixed(3)}, ${coordinate[1].toFixed(3)}`;
}

/**
 * featureCollectionId1 で指定した FeatureCollection の LineString から coordinates に隣接するセグメントを含み、 selectedFeatures に含まれるセグメントを除いたリストを返す。リスト内のセグメントは重複しない。
 * @param points 対象の点
 * @param featureCollectionId1 追加するセグメントを含むFeatureCollectionのID
 * @param selectedFeatures 既に選択しているセグメント
 */
export function selectAdjoinedLineStringSegments(saveData: SaveDataType, points: Feature<Point>[], featureCollectionId1: string, selectedFeatures: FeatureAt[]) {
  const adjoinedSegments: FeatureAt[] = [];

  const featureCollection1 = saveData.featureCollections[featureCollectionId1].value;
  featureCollection1.features.forEach((feature1, featureIndex1) => {
    const geometry1 = feature1.geometry;
    if (geometry1.type !== 'LineString') return;

    const coordinates1 = (geometry1 as LineString).coordinates;
    for (let i = 0; i < coordinates1.length; i++) {
      points.forEach(point => {
        if (booleanEqual(point, turfPoint(coordinates1[i]))) {
          if (i !== coordinates1.length - 1) {
            // 選択済み、追加済みのセグメントは追加しない
            if (selectedFeatures.find(featureAt1 =>
              featureAt1.featureCollectionId === featureCollectionId1
              && featureAt1.featureIndex === featureIndex1
              && featureAt1.segmentIndex === i
            ) === undefined
              && adjoinedSegments.find(featureAt1 =>
                featureAt1.featureCollectionId === featureCollectionId1
                && featureAt1.featureIndex === featureIndex1
                && featureAt1.segmentIndex === i
              ) === undefined)
              adjoinedSegments.push({
                featureCollectionId: featureCollectionId1,
                featureIndex: featureIndex1,
                segmentIndex: i,
              });
          }

          if (i !== 0) {
            if (selectedFeatures.find(featureAt1 =>
              featureAt1.featureCollectionId === featureCollectionId1
              && featureAt1.featureIndex === featureIndex1
              && featureAt1.segmentIndex === i - 1
            ) === undefined
              && adjoinedSegments.find(featureAt1 =>
                featureAt1.featureCollectionId === featureCollectionId1
                && featureAt1.featureIndex === featureIndex1
                && featureAt1.segmentIndex === i - 1
              ) === undefined)
              adjoinedSegments.push({
                featureCollectionId: featureCollectionId1,
                featureIndex: featureIndex1,
                segmentIndex: i - 1,
              });
          }
        }
      })
    }
  });

  return adjoinedSegments;
}
