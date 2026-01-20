export default (() => 
  ((opts) => {
    console.log('Rendering Stateful Component 6', opts)
    opts.refs.container.innerText = opts.state.content.value;
  })
);
