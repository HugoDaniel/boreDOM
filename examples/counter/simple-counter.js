import { webComponent } from "./boreDOM.min.js";

export const SimpleCounter = webComponent(({ on }) => {
  on("increase", (mutableState) => {
    mutableState.value += 1;
  });
  on("decrease", (mutableState) => {
    mutableState.value -= 1;
  });

  return (({ state, self }) => {
    self.slots.counter = `${state.value}`;
  });
});
