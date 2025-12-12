import { webComponent } from "/dist/boreDOM.min.js"

// Subscribes to parent path, should re-render when child changes
export const HierarchicalParentComponent = webComponent(() => {
  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    // Access the parent object - subscribes to "user"
    const user = state.user
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-user-name", user?.name ?? "none")
  }
})

// Subscribes to child path, should re-render when parent changes
export const HierarchicalChildComponent = webComponent(() => {
  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    // Access the child path - subscribes to "user.name"
    const name = state.user?.name
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-name", name ?? "none")
  }
})
