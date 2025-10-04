import { webComponent } from "/dist/boreDOM.min.js"

export const StatefulComponent9 = webComponent(({ on }) => {
  on("update", async ({ state: mutableState }) => {
    await Promise.resolve()
    mutableState.content.value = "This is async content"
  })

  return ({ state, refs }) => {
    refs.container.innerText = state.content.value
  }
})
