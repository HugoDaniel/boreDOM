import { webComponent } from "/dist/boreDOM.min.js";

export const StatefulComponent1 = webComponent(() => {
  console.log('Initializing Stateful Component 1')
  return ((opts, element) => {
    console.log('Rendering Stateful Component 1')
    const elementAddedInRender = document.createElement("p");
    elementAddedInRender.innerText = "Render";
    element.appendChild(elementAddedInRender);
  });
});
