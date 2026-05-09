import { cameraControlsState } from '@/src/components/cameras-and-controls/CameraControls';
import { camerasState } from '@/src/components/cameras-and-controls/Cameras';
import * as THREE from 'three';

export function setCameraTargetPosition(targetPosition: THREE.Vector3, interruptControls = false) {
  const camera = camerasState.cameraRefs[camerasState.mainCameraKey];
  const mainControls = cameraControlsState.controlsRefs[cameraControlsState.mainControlsKey];
  if (!camera || !mainControls) return;

  if (interruptControls) {
    // 1. まず現在の位置で慣性を無効化・中断（進行中の滑る動きをリセット）
    const originalDamping = mainControls.enableDamping;
    mainControls.enableDamping = false;
    mainControls.update();

    // 2. 慣性が完全に止まった状態で、新しいフォーカス位置を設定
    camera.position.add(targetPosition.clone().sub(mainControls.target));
    mainControls.target.copy(targetPosition);

    // 3. 新しいフォーカス位置をコントロールに適用
    mainControls.update();
    mainControls.enableDamping = originalDamping;
  } else {
    // 通常のフォーカス
    camera.position.add(targetPosition.clone().sub(mainControls.target));
    mainControls.target.copy(targetPosition);
  }
}
