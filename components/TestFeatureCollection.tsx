import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Position } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import { getRelativePosition, getOriginEuler, eulerToCoordinate, getMeridianAngle } from '@/lib/gis'
import SetCameraAndControlsPositionGIS from './cameras-and-controls/SetCameraAndControlsPositionGIS'
import FeatureCollection from './FeatureCollection'
import featureCollection from '@/data/sakurajosui.geojson'

const centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

function getRotation(centerCoordinate: Position, originCoordinateEuler?: THREE.Euler, originCoordinate?: Position) {
  return new THREE.Euler(0, getMeridianAngle(centerCoordinate, originCoordinateEuler, originCoordinate), 0, 'YXZ')
}

export default function TestFeatureCollection() {
  let originCoordinateEuler = getOriginEuler()
  let originCoordinate = eulerToCoordinate(originCoordinateEuler)

  const [centerPosition, setCenterPosition] = React.useState<THREE.Vector3>(getRelativePosition(originCoordinate, originCoordinateEuler, originCoordinate))
  const [rotation, setRotation] = React.useState(getRotation(originCoordinate, originCoordinateEuler, originCoordinate))

  useFrame(() => {
    originCoordinateEuler = getOriginEuler()
    originCoordinate = eulerToCoordinate(originCoordinateEuler)

    setCenterPosition(getRelativePosition(originCoordinate, originCoordinateEuler, originCoordinate))
    setRotation(getRotation(originCoordinate, originCoordinateEuler, originCoordinate))
  })

  return (
    <>
      <SetCameraAndControlsPositionGIS coordinate={centerCoordinate} />
      <group position={centerPosition} rotation={rotation}>
        <FeatureCollection featureCollection={featureCollection} centerCoordinate={originCoordinate} />
      </group>
    </>
  )
}
