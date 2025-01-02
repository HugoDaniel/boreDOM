import { webComponent } from "/dist/boreDOM.min.js";

export const ListItem1 = webComponent(
  () => ({ self, detail }) => {
    console.log("Rendering List Item 1", detail);
    self.innerText = detail.data;
  },
);
