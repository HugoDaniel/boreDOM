// Tests array method reactivity (push, splice, etc.)
export default (({ on }) => {
  on("push", ({ state: mutable }) => {
    mutable.items.push("new item")
  })

  on("pop", ({ state: mutable }) => {
    mutable.items.pop()
  })

  on("splice", ({ state: mutable }) => {
    mutable.items.splice(1, 1, "spliced")
  })

  on("setLength", ({ state: mutable }) => {
    mutable.items.length = 1
  })

  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-items", state.items.join(","))
    self.setAttribute("data-length", String(state.items.length))
  }
})
