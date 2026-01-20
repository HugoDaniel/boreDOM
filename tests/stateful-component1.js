export default (() => {
  console.log("Initializing Stateful Component 1");
  return (({ self }) => {
    console.log("Rendering Stateful Component 1");
    const elementAddedInRender = document.createElement("p");
    elementAddedInRender.innerText = "Render";
    self.appendChild(elementAddedInRender);
  });
});
