import * as React from 'react'
import * as THREE from 'three'
import { OrbitControls as OrbitControlsImpl, MapControls as MapControlsImpl } from 'three-stdlib'
import { MapControls, OrbitControls } from '@react-three/drei'
import { proxy, ref, useSnapshot } from 'valtio'
import { camerasState } from './Cameras'
import { useFrame, useThree } from '@react-three/fiber'
import { trainsTabPanelState } from '@/lib/client/trains'
import { guiState } from '@/lib/client/gui'

export type ControlsRefs = {
  [key: string]: OrbitControlsImpl
}

export const cameraControlsModeState = proxy<{ mainControlsKey: string }>({
  mainControlsKey: "orbitControls",
})

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
  const { mainControlsKey } = useSnapshot(cameraControlsModeState)
  const { editingTrainFormat } = useSnapshot(trainsTabPanelState);
  const { selectedTab } = useSnapshot(guiState);
  const { camera } = useThree();

  const isPreviewMode = !!editingTrainFormat && selectedTab === "trains";
  const activeControlsKey = isPreviewMode ? "orbitControls" : mainControlsKey;

  const orbitControlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const mapControlsRef = React.useRef<MapControlsImpl | null>(null);
  const lastTarget = React.useRef(new THREE.Vector3());

  const getActiveControls = React.useCallback(() => {
    return activeControlsKey === "mapControls"
      ? mapControlsRef.current
      : orbitControlsRef.current;
  }, [activeControlsKey]);

  const syncTarget = React.useCallback((controls: OrbitControlsImpl | MapControlsImpl) => {
    lastTarget.current.copy(controls.target);
    cameraControlsState.target = controls.target.clone();
  }, []);

  const applyTarget = React.useCallback((controls: OrbitControlsImpl | MapControlsImpl) => {
    controls.target.copy(lastTarget.current);
    controls.update();
  }, []);

  const orbitControlsCallback = React.useCallback((controls: OrbitControlsImpl | null) => {
    orbitControlsRef.current = controls;
    if (controls) {
      cameraControlsState.controlsRefs["orbitControls"] = controls;
      applyTarget(controls);
    } else {
      delete cameraControlsState.controlsRefs["orbitControls"];
    }
  }, [applyTarget]);

  const mapControlsCallback = React.useCallback((controls: MapControlsImpl | null) => {
    mapControlsRef.current = controls;
    if (controls) {
      cameraControlsState.controlsRefs["mapControls"] = controls;
      applyTarget(controls);
    } else {
      delete cameraControlsState.controlsRefs["mapControls"];
    }
  }, [applyTarget]);

  const handleOrbitChange = React.useCallback(() => {
    const controls = orbitControlsRef.current;
    if (controls) syncTarget(controls);
  }, [syncTarget]);

  const handleMapChange = React.useCallback(() => {
    const controls = mapControlsRef.current;
    if (controls) syncTarget(controls);
  }, [syncTarget]);

  React.useEffect(() => {
    const controls = getActiveControls();
    if (!controls) return;

    if (isPreviewMode) {
      if (!cameraControlsState.savedWorldState) {
        cameraControlsState.savedWorldState = {
          position: camera.position.clone(),
          target: lastTarget.current.clone(),
          controlsKey: activeControlsKey
        };

        lastTarget.current.set(0, 0, 0);
        controls.target.set(0, 0, 0);
        camera.position.set(-20, 20, -20);
        controls.update();
      }
    } else if (cameraControlsState.savedWorldState) {
      const { position, target } = cameraControlsState.savedWorldState;
      lastTarget.current.copy(target);
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      cameraControlsState.savedWorldState = undefined;
    }
  }, [isPreviewMode, activeControlsKey, camera, getActiveControls]);

  useFrame(() => {
    const controls = getActiveControls();
    if (controls) syncTarget(controls);
  });

  return activeControlsKey === "mapControls" ? (
    <MapControls
      ref={mapControlsCallback}
      makeDefault
      camera={cameraRefs[mainCameraKey] as THREE.Camera}
      zoomSpeed={5}
      minDistance={1}
      onChange={handleMapChange}
    />
  ) : (
    <OrbitControls
      ref={orbitControlsCallback}
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
      onChange={handleOrbitChange}
    />
  )
}
