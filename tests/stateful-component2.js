export default ((opts) => {
  console.log('Initializing Stateful Component 2', opts)
  const somethingRef = opts.refs.something;
  return ((opts, element) => {
    console.log('Rendering Stateful Component 2', opts)
    somethingRef.innerText = "Something ref innerText updated";
  });
});
