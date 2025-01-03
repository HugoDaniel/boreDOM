import { webComponent } from "/dist/boreDOM.min.js";

export const ListComponent1 = webComponent(
  () => {
    return (({ makeComponent, state, self }) => {
      console.log("Rendering List Component 1", state);
      const listContainer = self.lastElementChild;
      listContainer.innerHTML = "";

       const items = state.content.items.map((data, index) =>
            makeComponent("list-item1", { detail: { index, data } })
       );

       listContainer.append(...items);
    });
  },
);
