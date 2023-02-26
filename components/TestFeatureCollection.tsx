import * as React from 'react'
import * as THREE from 'three'
import { state as sunAndSkyState } from './SunAndSky'
import { useFrame } from '@react-three/fiber'
import pointOnFeature from '@turf/point-on-feature'
import { getRelativePosition, getOriginEuler } from '@/lib/gis'
import FeatureCollection from './FeatureCollection'
import featureCollection from '@/data/sakurajosui.geojson'

const centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

export default function TestFeatureCollection() {
  const [centerPosition, setCenterPosition] = React.useState<THREE.Vector3>(getRelativePosition(centerCoordinate))
  const [rotation, setRotation] = React.useState(new THREE.Euler(0, getOriginEuler().z, 0))

  useFrame(() => {
    setCenterPosition(getRelativePosition(centerCoordinate))
    setRotation(new THREE.Euler(0, getOriginEuler().z, 0))
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
