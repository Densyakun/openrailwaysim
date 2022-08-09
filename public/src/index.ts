import Game from './Game';
import RailObjectSystem from './system/RailObjectSystem';
import LightSystem from './system/LightSystem';
import CameraSystem from './system/CameraSystem';
import './style.css';

const game = new Game();

game.addSystem(RailObjectSystem);
game.addSystem(LightSystem);
game.addSystem(CameraSystem);

game.animate();
