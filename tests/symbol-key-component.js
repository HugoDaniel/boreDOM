// Tests that Symbol keys do not trigger re-renders
export default (() => {
  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-count", String(state.count))
  }
})
