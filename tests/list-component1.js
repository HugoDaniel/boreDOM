export default (() => {
  return (({ state, self }) => {
    console.log("Rendering List Component 1", state);
    const listContainer = self.lastElementChild;
    
    if (!state.content || !state.content.items) return;

    listContainer.innerHTML = state.content.items.map((_, index) =>
      `<list-item1 data-index="${index}"></list-item1>`
    ).join("");
  });
});