import System from './System';
import * as THREE from 'three';

export default class LightSystem extends System {
  load() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.castShadow = true;
    this.game.scene.add(directionalLight);
  }
}
