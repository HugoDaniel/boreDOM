import { webComponent } from "../../dist/boredom.js";

export default webComponent(({ on, self }) => {
  const squares = () => Array.from(self.querySelectorAll("game-button"));

  // `play` is dispatched from inside <game-button>, which has no handler, so it bubbles here.
  on("play", ({ state, e }) => {
    const index = squares().indexOf(e.dispatcher.closest("game-button"));
    if (state.winner || state.board[index]) return;
    // The board is a frozen value: a move is a new board with one square changed.
    state.board = Object.freeze(state.board.with(index, state.next));
    state.next = state.next === "O" ? "X" : "O";
    state.winner = winner(state.board);
  });

  return ({ state }) => {
    squares().forEach((square, index) => {
      square.querySelector("button").textContent = state.board[index] ?? "";
    });
  };
});

const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winner(board) {
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? "nobody" : null;
}
