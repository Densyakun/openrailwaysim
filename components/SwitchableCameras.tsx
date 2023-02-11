import * as React from 'react'
import * as THREE from 'three'
import { PerspectiveCamera, OrthographicCamera, OrbitControls, MapControls } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { state } from './MapCameraSwitch'

export default function SwitchableCameras() {
  const { showingMapCamera: viewIsMap } = useSnapshot(state)

  const defaultCamera = React.useRef<THREE.PerspectiveCamera>(null!)
  const mapCamera = React.useRef<THREE.OrthographicCamera>(null!)

  return (
    <>
      <PerspectiveCamera
        ref={defaultCamera}
        makeDefault={!viewIsMap}
        position={[0, 0, 10]}
      />
      <OrthographicCamera
        ref={mapCamera}
        makeDefault={viewIsMap}
        position={[0, 100, 0]}
        rotation={[0, 0, -90]}
        zoom={50}
      />
      <OrbitControls
        camera={defaultCamera.current}
        enabled={!viewIsMap}
      />
      <MapControls
        camera={mapCamera.current}
        enabled={viewIsMap}
      />
    </>
  )
}
