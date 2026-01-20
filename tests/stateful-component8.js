export default (({ on }) => {
  on("update", ({ state: mutableState }) => {
    mutableState.content.value[0] = "This is new content";
    console.log("Got update", mutableState);
  });

  return ((opts) => {
    console.log("Rendering Stateful Component 8", opts);

    opts.state.content.value.forEach((v) => {
      opts.refs.container.innerText = v;
    });
  });
});
