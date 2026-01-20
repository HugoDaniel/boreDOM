export default (({ state, refs }) => {
  return () => {
    refs.value.textContent = state.content.nested.value
  }
})
