import { webComponent } from "/dist/boreDOM.min.js"

export const MultiHyphenComponentExtra = webComponent(() => {
  return ({ self }) => {
    self.setAttribute("data-loaded", "multi-hyphen-component-extra")
  }
})
