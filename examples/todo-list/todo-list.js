import { keyed, webComponent } from "../../dist/boredom.js";

export default webComponent(({ on }) => {
  on("add", ({ state, refs, e }) => {
    e.event.preventDefault();
    const text = refs.input.value.trim();
    if (!text) return;
    state.todos.push({ id: Date.now(), text, done: false });
    refs.input.value = "";
  });

  return ({ state, refs }) => {
    keyed(refs.list, state.todos, (todo) => todo.id, (todo) =>
      Object.assign(document.createElement("todo-item"), { todo }));
  };
});
