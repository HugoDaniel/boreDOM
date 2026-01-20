export default (({ on, state: immutableState }) => {
  on("incrementClick", ({ state: mutableState }) => {
    mutableState.value += 1;
  });

  return ((opts) => {
    console.log("Rendering On Event Component 2", opts);
    opts.refs.label.innerText = immutableState.value;
  });
});
