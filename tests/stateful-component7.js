export default (() => ((opts) => {
  console.log("Rendering Stateful Component 7", opts);
  opts.refs.container.innerText = opts.state.content.value[0];
}));
