import { webComponent } from "/dist/boreDOM.min.js"

export const StatefulComponent10 = webComponent(({ state, refs }) => {
  return () => {
    refs.value.textContent = state.content.nested.value
  }
})
