import { cameraControlsState } from '@/src/components/cameras-and-controls/CameraControls';
import { camerasState } from '@/src/components/cameras-and-controls/Cameras';
import * as THREE from 'three';

export function setCameraTargetPosition(targetPosition: THREE.Vector3) {
  const camera = camerasState.cameraRefs[camerasState.mainCameraKey];
  const mainControls = cameraControlsState.controlsRefs[cameraControlsState.mainControlsKey];
  if (!camera || !mainControls) return;

  camera.position.add(targetPosition.clone().sub(mainControls.target));
  mainControls.target.copy(targetPosition);
}
