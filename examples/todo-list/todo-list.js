import { keyed, webComponent } from "../../dist/boredom.js";

// Todos are values: every change replaces `state.todos` with a new frozen
// array, and a changed todo is a new frozen object. The item that shows a
// todo gets it through its `local`, so only that item re-renders.
const freeze = Object.freeze;

export default webComponent(({ on }) => {
  on("add", ({ state, refs, e }) => {
    e.event.preventDefault();
    const text = refs.input.value.trim();
    if (!text) return;
    state.todos = freeze(state.todos.concat(freeze({ id: Date.now(), text, done: false })));
    refs.input.value = "";
  });
  // Dispatched inside a <todo-item>, which has no handler for them, so they bubble here.
  on("toggle", ({ state, e }) => {
    const todo = e.dispatcher.closest("todo-item").local.todo;
    state.todos = freeze(state.todos.map((t) => (t === todo ? freeze({ ...t, done: !t.done }) : t)));
  });
  on("remove", ({ state, e }) => {
    const todo = e.dispatcher.closest("todo-item").local.todo;
    state.todos = freeze(state.todos.filter((t) => t !== todo));
  });

  return ({ state, refs }) => {
    keyed(refs.list, state.todos, (todo) => todo.id,
      (todo) => { const item = document.createElement("todo-item"); item.local.todo = todo; return item; },
      (item, todo) => { item.local.todo = todo; });
  };
});
