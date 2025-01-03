import { webComponent } from "/dist/boreDOM.min.js";

export const ListItem1 = webComponent(
  (opts) => {
    console.log('Initializing List Item 1', opts);

    return ({ self, detail }) => {
      console.log("Rendering List Item 1", detail);
      if (detail === undefined) return;
      self.innerText = detail.data;
    }
  }
);
