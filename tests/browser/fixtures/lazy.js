// Loaded through <template data-src>. Imports the built runtime on purpose:
// it must interoperate with the test bundle, which is a separate instance.
import { webComponent } from "/dist/boredom.js";

export default webComponent(() => ({ self }) => {
  self.textContent = "lazy loaded";
});
