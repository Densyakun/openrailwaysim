import * as React from 'react'
import * as THREE from 'three'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { OrbitControls } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'
import { camerasState } from './Cameras'
import { useFrame, useThree } from '@react-three/fiber'
import { trainsTabPanelState } from '@/lib/client/trains'
import { guiState } from '@/lib/client/gui'

export type ControlsRefs = {
  [key: string]: OrbitControlsImpl
}

export const cameraControlsState = proxy<{
  mainControlsKey: string;
  controlsRefs: ControlsRefs;
  target: THREE.Vector3;
  savedWorldState?: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    controlsKey: string;
  };
}>({
  mainControlsKey: "orbitControls",
  controlsRefs: ref<ControlsRefs>({}),
  target: new THREE.Vector3(),
})

export default function CameraControls() {
  const { cameraRefs, mainCameraKey } = useSnapshot(camerasState)
  const { editingTrainFormat } = useSnapshot(trainsTabPanelState);
  const { selectedTab } = useSnapshot(guiState);
  const { camera } = useThree();

  const isPreviewMode = !!editingTrainFormat && selectedTab === "trains";

  React.useEffect(() => {
    const orbitControls = cameraControlsState.controlsRefs["orbitControls"];
    if (!orbitControls) return;

    if (isPreviewMode) {
      if (!cameraControlsState.savedWorldState) {
        // Save world state
        cameraControlsState.savedWorldState = {
          position: camera.position.clone(),
          target: (orbitControls as OrbitControlsImpl).target.clone(),
          controlsKey: "orbitControls"
        };

        // Set preview state
        orbitControls.target.set(0, 0, 0);
        camera.position.set(20, 20, 20);
        orbitControls.update();
      }
    } else if (cameraControlsState.savedWorldState) {
      // Restore world state
      const { position, target } = cameraControlsState.savedWorldState;
      orbitControls.target.copy(target);
      camera.position.copy(position);
      orbitControls.update();
      cameraControlsState.savedWorldState = undefined;
    }
  }, [isPreviewMode, camera]);

  const orbitControlsRef = React.useCallback((orbitControls: OrbitControlsImpl) => {
    cameraControlsState.controlsRefs["orbitControls"] = orbitControls;
  }, [])

  useFrame(() => {
    const orbitControls = cameraControlsState.controlsRefs["orbitControls"]
    if (orbitControls)
      cameraControlsState.target = (orbitControls as OrbitControlsImpl).target.clone()
  })

  return (
    <OrbitControls
      ref={orbitControlsRef}
      makeDefault
      camera={cameraRefs[mainCameraKey] as THREE.Camera}
      zoomSpeed={5}
      minDistance={1}
      mouseButtons={isPreviewMode ? {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
      } : {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      }}
      touches={isPreviewMode ? {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN
      } : {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      }}
      screenSpacePanning={!isPreviewMode}
    />
  )
}
