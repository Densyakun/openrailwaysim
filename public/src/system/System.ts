import Game from '../Game';

export default class System {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }
  load() { }
  update() { }
}
