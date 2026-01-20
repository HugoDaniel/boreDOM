export default (({ detail }) => {
  return ({ self, detail }) => {
    // Mark each instance with its initialization index and some content
    if (detail && typeof detail.index === "number") {
      self.setAttribute("data-index", String(detail.index));
      self.textContent = `Index: ${detail.index}`;
    }
  };
});

