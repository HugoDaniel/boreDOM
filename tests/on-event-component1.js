export default (({ on, state }) => {
  on("someCustomEventOnClick", () => {
    state.clicked = true;
  });

  return ((opts) => {
    console.log("Rendering On Event Component 1", opts);
  });
});