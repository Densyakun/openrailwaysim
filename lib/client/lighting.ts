import { proxy, ref } from "valtio";
import * as THREE from "three";

export const lightingState = proxy<{
  directionalLight: { value?: THREE.DirectionalLight };
  elevation: number;
  azimuth: number;
}>({
  directionalLight: ref<{ value?: THREE.DirectionalLight }>({}),
  elevation: 0,
  azimuth: Math.PI / 2,
})
