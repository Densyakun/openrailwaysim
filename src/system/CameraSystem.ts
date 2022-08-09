import System from './System';
import * as THREE from 'three';

export default class CameraSystem extends System {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  load() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.camera.position.z = 5;

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  update() {
    this.renderer.render(this.game.scene, this.camera);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
