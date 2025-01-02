import { webComponent } from "/dist/boreDOM.min.js";

export const StatefulComponent3 = webComponent((opts) => {
  console.log('Initializing Stateful Component 3', opts)
  // This must throw:
  opts.refs.somethingThatDoesNotExist;
  return ((opts, element) => {
    console.log('Rendering Stateful Component 3', opts)
  });
});
