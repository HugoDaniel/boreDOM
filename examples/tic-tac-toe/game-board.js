import { webComponent } from "./boreDOM.min.js";

export const GameBoard = webComponent(({ on, self }) => {
  on("play", ({ state: mutableState, e: { event } }) => {
    const index = Array.from(self.children).indexOf(
      event.currentTarget.parentNode,
    );
    const isGameWon = mutableState.gameState.winner !== null;
    const isEmptySquare = mutableState.gameState.board[index] === undefined;

    if (!isGameWon && isEmptySquare) {
      mutableState.gameState.board[index] = mutableState.gameState.nextToPlay;
      // Update the next to play:
      mutableState.gameState.nextToPlay =
        mutableState.gameState.nextToPlay === "O" ? "X" : "O";
      // Update the winner state
      mutableState.gameState.winner = calculateWinner(
        mutableState.gameState.board,
      );
    }
  });

  return (({ state }) => {
    let index = 0;
    for (const child of self.children) {
      const boardValue = state.gameState.board[index++];

      if (boardValue) {
        child.slots.valuePlayed = boardValue;
      }
    }
  });
});

/**
 * Taken from https://react.dev/learn/tutorial-tic-tac-toe
 */
function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}
