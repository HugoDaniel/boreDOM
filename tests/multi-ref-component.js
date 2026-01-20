// Tests multiple elements with the same data-ref name
export default (() => {
  return ({ self, refs }) => {
    const items = refs.item
    if (Array.isArray(items)) {
      self.setAttribute("data-ref-count", String(items.length))
      items.forEach((item, i) => {
        item.textContent = `Item ${i}`
      })
    } else {
      self.setAttribute("data-ref-count", "1")
      items.textContent = "Single item"
    }
  }
})
