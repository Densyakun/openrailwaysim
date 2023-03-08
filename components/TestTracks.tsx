import * as React from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three-stdlib'
import { useLoader } from '@react-three/fiber'
//import { Line } from '@react-three/drei'
import pointOnFeature from '@turf/point-on-feature'
import { getProjectedLines } from '@/lib/gis'
import SetCameraAndControlsPositionGIS from './cameras-and-controls/SetCameraAndControlsPositionGIS'
import FeatureObject from './FeatureObject'
import featureCollection from '@/data/sakurajosui.geojson'

const centerCoordinate = pointOnFeature(featureCollection).geometry.coordinates

const projectedLines = getProjectedLines(featureCollection)

function Rail(props: any) {
  const { scene } = useLoader(GLTFLoader, 'https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50kgn-1067.gltf')

  return (
    <primitive {...props} object={scene.clone()} />
  )
}

export default function TestTracks() {
  return (
    <>
      <SetCameraAndControlsPositionGIS coordinate={centerCoordinate} />
      {projectedLines.map((projectedLine, index) => {
        return <FeatureObject key={index} centerCoordinate={projectedLine.centerCoordinate}>
          {/*<Line points={projectedLine.points} />*/}
          {projectedLine.points.map((point, index, array) => {
            if (array.length <= index + 1) return undefined

            return <Rail
              key={index}
              position={point}
              rotation={new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, -1),
                array[index + 1].clone().sub(point).normalize()
              ))}
              scale={new THREE.Vector3(1, 1, point.distanceTo(array[index + 1]))}
            />
          })}
        </FeatureObject>
      })}
    </>
  )
}
