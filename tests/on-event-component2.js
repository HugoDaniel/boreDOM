import { webComponent } from "/dist/boreDOM.min.js";

export const onEventComponent2 = webComponent(({ on, state: immutableState }) => {
  on("incrementClick", (mutableState) => {
    mutableState.value += 1;
  });

  return ((opts) => {
    console.log("Rendering On Event Component 2", opts);
    opts.refs.label.innerText = immutableState.value;
  });
});
