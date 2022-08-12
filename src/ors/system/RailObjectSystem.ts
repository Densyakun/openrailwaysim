import System from './System';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class RailObjectSystem extends System {
  gltfScene: THREE.Group;

  load() {
    const loader = new GLTFLoader();
    loader.load('https://raw.githubusercontent.com/Densyakun/assets/main/railway/track/rail-50kgn-1067.gltf',
      (gltf) => {
        if (gltf) {
          this.gltfScene = gltf.scene;
          this.game.scene.add(this.gltfScene);
        }
      },
      undefined,
      (error) => {
        console.error(error);
      });
  }

  update() {
    if (this.gltfScene) {
      this.gltfScene.rotation.x += 0.01;
      this.gltfScene.rotation.y += 0.01;
    }
  }

  destroy() {
    this.game.scene.remove(this.gltfScene);
  }
}
