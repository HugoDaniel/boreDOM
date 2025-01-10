import { webComponent } from "/dist/boreDOM.min.js";

export const StatefulComponent7 = webComponent(() => ((opts) => {
  console.log("Rendering Stateful Component 7", opts);
  opts.refs.container.innerText = opts.state.content.value[0];
}));
