// Subscribes to parent path, should re-render when child changes
export default (() => {
  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    // Access the parent object - subscribes to "user"
    const user = state.user
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-user-name", user?.name ?? "none")
  }
})
