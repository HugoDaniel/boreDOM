import { webComponent } from "./boreDOM.min.js";

export const SimpleCounter = webComponent(({ on }) => {
  on("increase", ({ state: mutableState }) => {
    mutableState.value += 1;
  });
  on("decrease", ({ state: mutableState }) => {
    mutableState.value -= 1;
  });

  return (({ state, self }) => {
    self.slots.counter = `${state.value}`;
  });
});
