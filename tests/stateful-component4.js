export default (() => 
  ((opts) => {
    console.log('Rendering Stateful Component 4', opts)
    opts.slots["some-slot"].innerHTML = `<stateful-component4b></stateful-component4b>`;
  })
);
