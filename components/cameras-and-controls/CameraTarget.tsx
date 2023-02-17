import * as React from 'react'
import * as THREE from 'three'
import { useFrame, Vector3 } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'
import Cameras from './Cameras'
import CameraControls, { state as ControlsState } from './CameraControls'

export const state = proxy<{
  target: {
    value?: THREE.Mesh;
  };
}>({
  target: ref<{
    value?: THREE.Mesh;
  }>({}),
})

export default function CameraTarget({ children }: { children?: React.ReactNode }) {
  const { target: { value: target } } = useSnapshot(state)
  const { controlsRefs, mainControlsKey } = useSnapshot(ControlsState)

  const targetRef = React.useCallback((target?: THREE.Mesh | null) => {
    state.target.value = target ?? undefined
  }, [])

  useFrame(() => {
    const mainControls = controlsRefs[mainControlsKey]
    if (mainControls) {
      const position = ((mainControls as any).target0 as THREE.Vector3) ?? undefined
      if (position && state.target.value?.position !== position) state.target.value?.position.set(position.x, position.y, position.z)
    }
  })

  const sunPosition: Vector3 = [
    100,
    200,
    300
  ]

  return (
    <>
      <ambientLight intensity={0.1} />
      <Cameras target={target?.position} />
      <CameraControls target={target?.position} />
      <mesh ref={targetRef} position={target?.position}>
        <directionalLight
          castShadow
          position={sunPosition}
          target={(target ?? new THREE.Object3D()) as THREE.Object3D}
        />
        <Sky sunPosition={
          target
            ? target.position.add(new THREE.Vector3(...sunPosition))
            : sunPosition
        } />
        {children}
      </mesh>
    </>
  )
}
