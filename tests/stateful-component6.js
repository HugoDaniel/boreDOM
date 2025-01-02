import { webComponent } from "/dist/boreDOM.min.js";

export const StatefulComponent6 = webComponent(() => 
  ((opts) => {
    console.log('Rendering Stateful Component 6', opts)
    opts.refs.container.innerText = opts.state.content.value;
  })
);
