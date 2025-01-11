import { inflictBoreDOM } from "./boreDOM.min.js";

inflictBoreDOM({
  gameState: {
    board: new Array(9),
    nextToPlay: "O",
    winner: null,
  },
});
