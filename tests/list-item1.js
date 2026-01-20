export default (
  (opts) => {
    console.log('Initializing List Item 1', opts);

    return ({ self, detail, state }) => {
      console.log("Rendering List Item 1", detail);
      if (detail === undefined) return;
      const index = detail.index;
      const item = state.content.items[index];
      self.innerText = item;
    }
  }
);