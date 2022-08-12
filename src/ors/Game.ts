import System from './system/System';
import * as THREE from 'three';

export default class Game {
  scene: THREE.Scene;
  systems: System[];

  constructor() {
    this.scene = new THREE.Scene();
    this.systems = [];
  }
  setSystem(systemType: typeof System) {
    const system = new systemType(this);
    for (let i = 0; i < this.systems.length; i++) {
      if (Object.getPrototypeOf(this.systems[i]).constructor.name === systemType.prototype.constructor.name) {
        this.systems[i].destroy();
        this.systems[i] = system;
        system.load();
        return;
      }
    }
    this.systems.push(system);
    system.load();
  }
  animate() {
    try {
      this.systems.forEach(system => system.update());

      requestAnimationFrame(() => this.animate());
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(error);
      } else {
        requestAnimationFrame(() => this.animate());
      }
    }
  }
}
