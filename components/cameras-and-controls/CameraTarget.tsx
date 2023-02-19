import * as React from 'react'
import * as THREE from 'three'
import { Vector3 } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'

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

  const targetRef = React.useCallback((target?: THREE.Mesh | null) => {
    state.target.value = target ?? undefined
  }, [])

  const sunPosition: Vector3 = [
    100,
    200,
    300
  ]

  return (
    <>
      <ambientLight intensity={0.1} />
      <mesh ref={targetRef} position={target?.position}>
        <directionalLight
          castShadow
          position={sunPosition}
          target={(target ?? new THREE.Object3D()) as THREE.Object3D}
        />
        <Sky sunPosition={sunPosition} />
        {children}
      </mesh>
    </>
  )
}
