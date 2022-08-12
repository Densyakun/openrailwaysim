import Game from './ors/Game';
import RailObjectSystem from './ors/system/RailObjectSystem';
import LightSystem from './ors/system/LightSystem';
import CameraSystem from './ors/system/CameraSystem';

const game = new Game();

game.setSystem(RailObjectSystem);
game.setSystem(LightSystem);
game.setSystem(CameraSystem);

game.animate();

if (module.hot) {
  module.hot.accept('./ors/system/RailObjectSystem.ts', function () {
    game.setSystem(RailObjectSystem);
  })
}
