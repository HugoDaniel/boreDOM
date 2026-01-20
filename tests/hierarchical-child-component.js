// Subscribes to child path, should re-render when parent changes
export default (() => {
  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    // Access the child path - subscribes to "user.name"
    const name = state.user?.name
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-name", name ?? "none")
  }
})
