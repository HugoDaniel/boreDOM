// Tests object replacement behavior
export default (() => {
  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-name", state.user?.name ?? "none")
    self.setAttribute("data-email", state.user?.email ?? "none")
  }
})
