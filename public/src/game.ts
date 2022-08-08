import * as THREE from 'three';

export class System {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }
  load() { }
  update() { }
}

export class Game {
  scene: THREE.Scene;
  systems: System[];

  constructor() {
    this.scene = new THREE.Scene();
    this.systems = [];
  }
  addSystem(systemType: typeof System) {
    const system = new systemType(this);
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
