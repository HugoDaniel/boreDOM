import { webComponent } from "/dist/boreDOM.min.js";

export const onEventComponent1 = webComponent(({ on, state }) => {
  on("someCustomEventOnClick", () => {
    // Call the test `done()` function
    state.onDone();
  });

  return ((opts) => {
    console.log("Rendering On Event Component 1", opts);
  });
});
