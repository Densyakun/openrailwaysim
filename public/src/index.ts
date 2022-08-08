import { Game } from './game';
import { RailObjectSystem } from './system/railObjectSystem';
import { LightSystem } from './system/lightSystem';
import { CameraSystem } from './system/cameraSystem';
import './style.css';

const game = new Game();

game.addSystem(RailObjectSystem);
game.addSystem(LightSystem);
game.addSystem(CameraSystem);

game.animate();
