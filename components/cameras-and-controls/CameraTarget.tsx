import * as React from 'react'
import * as THREE from 'three'
import { proxy, useSnapshot } from 'valtio'
import Cameras from './Cameras'
import CameraControls from './CameraControls'

export const state = proxy<{ target: THREE.Vector3 }>({ target: new THREE.Vector3() })

export default function CameraTarget({ children }: { children?: React.ReactNode }) {
  const { target } = useSnapshot(state)

  return (
    <>
      <Cameras position={target} />
      <CameraControls target={target} />
      <mesh position={target}>
        {children}
      </mesh>
    </>
  )
}
