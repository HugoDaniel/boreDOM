/** @typedef {import("./types.ts").UIState} UIState */
/** @typedef {import("boredom").inflictBoreDOM<UIState>} */
import { inflictBoreDOM } from "../boreDOM.js";

/** @type UIState */
const initialUIState = {
  colors: ["#ff00ff", "#ffad00", "#3366EE"],
  selected: 0,
};

const uiState = await inflictBoreDOM(initialUIState);

console.log(
  "This is the ui state object: ",
  uiState,
  "\nIts a proxified object \
  if WebComponentRenderParamsyou change it the ui is automatically updated.",
);
