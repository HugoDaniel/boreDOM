import { webComponent } from "./boreDOM.min.js";

export const GameTurn = webComponent(() => {
  return (({ state, self }) => {
    if (state.gameState.winner) {
      self.slots.playerTurn = `Victory for Player ${state.gameState.winner}`;
    } else {
      self.slots.playerTurn = `Next player: ${state.gameState.nextToPlay}`;
    }
  });
});
