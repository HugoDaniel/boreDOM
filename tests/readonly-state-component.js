import { webComponent } from "/dist/boreDOM.min.js"

// Attempts to mutate state in render - should be blocked
export const ReadonlyStateComponent = webComponent(() => {
  return ({ self, state }) => {
    // This mutation should be blocked and log an error
    try {
      state.value = "mutated in render"
    } catch (e) {
      // Proxy may throw or just block
    }
    self.setAttribute("data-value", String(state.value))
  }
})
