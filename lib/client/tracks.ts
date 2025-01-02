// Fast Refresh のため Tracks.tsx より分離

import * as THREE from "three";

export let railModelFactor = 60; //曲線に設置するレールのモデルの個数の係数

export function getNumberOfCurvePoints(length: number, radius: number) {
  return Math.max(1, Math.ceil(length * railModelFactor / Math.abs(radius)))
}

export function getRotationFromTwoPoints(point: THREE.Vector3, nextPoint: THREE.Vector3, rotationX: number) {
  const euler = new THREE.Euler(0, 0, 0, 'XZY').setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      nextPoint.clone().sub(point).normalize()
    ), 'YXZ'
  )
  euler.z = -rotationX
  return euler
}
