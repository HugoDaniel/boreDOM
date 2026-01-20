// Exposes render count via data attribute for test verification
export default (() => {
  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-values", `${state.a},${state.b},${state.c}`)
  }
})