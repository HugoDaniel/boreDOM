import { webComponent } from "../../dist/boredom.js";

export default webComponent(({ on }) => {
  on("reset", ({ state }) => {
    state.board = Object.freeze(Array(9).fill(null));
    state.next = "O";
    state.winner = null;
  });

  return ({ state, refs }) => {
    refs.label.textContent = state.winner
      ? `Victory for ${state.winner}`
      : `Next player: ${state.next}`;
  };
});
