import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Position } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import { getRelativePosition, getOriginEuler, eulerToCoordinate, getMeridianAngle } from '@/lib/gis'
import { state as sunAndSkyState } from './SunAndSky'
import FeatureCollection from './FeatureCollection'
import featureCollection from '@/data/sakurajosui.geojson'

const centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

function getRotation(originCoordinateEuler?: THREE.Euler, originCoordinate?: Position) {
  return new THREE.Euler(0, getMeridianAngle(centerCoordinate, originCoordinateEuler, originCoordinate), 0, 'YXZ')
}

export default function TestFeatureCollection() {
  const originCoordinateEuler = getOriginEuler()

  const originCoordinate = eulerToCoordinate(originCoordinateEuler)

  const [centerPosition, setCenterPosition] = React.useState<THREE.Vector3>(getRelativePosition(centerCoordinate, originCoordinateEuler, originCoordinate))
  const [rotation, setRotation] = React.useState(getRotation(originCoordinateEuler, originCoordinate))

  useFrame(() => {
    const originCoordinateEuler = getOriginEuler()

    const originCoordinate = eulerToCoordinate(originCoordinateEuler)

    setCenterPosition(getRelativePosition(centerCoordinate, originCoordinateEuler, originCoordinate))
    setRotation(getRotation(originCoordinateEuler, originCoordinate))
  })

  React.useEffect(() => {
    // Set sun position
    sunAndSkyState.elevation = 1
  }, [])

  return (
    <>
      <group position={centerPosition} rotation={rotation}>
        <FeatureCollection featureCollection={featureCollection} centerCoordinate={centerCoordinate} />
      </group>
    </>
  )
}
