import { webComponent } from "/dist/boreDOM.min.js"

export const StatefulComponent11 = webComponent(({ state, refs }) => {
  return () => {
    if (!state.gpu.isReady) return
    refs.info.textContent = `Adapter: ${state.gpu.info.adapter} | Device: ${state.gpu.info.device}`
  }
})
