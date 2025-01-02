import { webComponent } from "/dist/boreDOM.min.js";

export const ListComponent1 = webComponent(
  () => {
    console.log("INIT list component 1");
    return (({ makeComponent, state, self }) => {
      console.log("Rendering List Component 1", state);
      const listContainer = self.lastChild;
      listContainer.innerHTML = "";

      listContainer.append(
        ...state.content.items.map((data, index) =>
          makeComponent("list-item1", {
            detail: { index, data },
          })
        ),
      );
    });
  },
);
