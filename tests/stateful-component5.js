import { webComponent } from "/dist/boreDOM.min.js";

export const StatefulComponent5 = webComponent(() => 
  ((opts) => {
    console.log('Rendering Stateful Component 5', opts)
    const p = document.createElement("p");
    p.innerText = "Text in a paragraph that replaced the slot";
    opts.slots["some-slot"] = p;
  })
);
