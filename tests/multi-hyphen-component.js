import { webComponent } from "/dist/boreDOM.min.js"

export const MultiHyphenComponent = webComponent(() => {
  return ({ self }) => {
    self.setAttribute("data-loaded", "multi-hyphen-component")
  }
})
