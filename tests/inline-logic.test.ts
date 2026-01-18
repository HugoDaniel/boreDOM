
import { expect } from "chai";
import { inflictBoreDOM, webComponent } from "../src/index";

export default function inlineLogicTests() {
  describe("Inline Logic Components", () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
      // Clean up registered components if possible, or just ignore since browser tests refresh
    });

    it("should load component logic from <script> inside <template>", async () => {
      // 1. Setup HTML
      const tagName = "inline-counter";
      
      // Inject the template with script into DOM
      const template = document.createElement("template");
      template.setAttribute("data-component", tagName);
      // Light DOM (default for boreDOM tests)
      
      // We construct the innerHTML carefully
      template.innerHTML = `
        <div class="count">Count: <slot name="value">0</slot></div>
        <button onclick="dispatch('inc')">+</button>
        
        <script type="module">
          // Standard boreDOM component definition
          export default ({ on }) => {
            on("inc", ({ state }) => {
              state.count++;
            });
            
            return ({ state, slots }) => {
              slots.value = String(state.count);
            };
          };
        </script>
      `;
      
      document.body.appendChild(template);

      // Create an instance of the component
      const instance = document.createElement(tagName);
      container.appendChild(instance);

      // 2. Initialize boreDOM
      const state = await inflictBoreDOM(
        { count: 10 },
        // No explicit componentsLogic passed - it should find it in the template!
        undefined, 
        { debug: false }
      );

      // 3. Verify Initial Render
      // Give it a tick to render
      await new Promise(r => setTimeout(r, 50));
      
      // Query LIGHT DOM
      const countDisplay = instance.querySelector(".count");
      expect(countDisplay).to.not.be.null;
      expect(countDisplay?.textContent).to.contain("Count: 10");

      // 4. Verify Interaction
      const btn = instance.querySelector("button");
      btn?.click();
      
      await new Promise(r => setTimeout(r, 50));
      expect(countDisplay?.textContent).to.contain("Count: 11");
      expect(state?.count).to.equal(11);
    });

    it("should handle multiple inline components", async () => {
      const tag1 = "inline-one";
      const tag2 = "inline-two";
      
      const t1 = document.createElement("template");
      t1.setAttribute("data-component", tag1);
      t1.innerHTML = `
        <span>One</span>
        <script type="module">
          export default () => ({ slots }) => { slots.default = "One rendered"; };
        </script>
      `;
      document.body.appendChild(t1);

      const t2 = document.createElement("template");
      t2.setAttribute("data-component", tag2);
      t2.innerHTML = `
        <span>Two</span>
        <script type="module">
          export default () => ({ slots }) => { slots.default = "Two rendered"; };
        </script>
      `;
      document.body.appendChild(t2);

      const el1 = document.createElement(tag1);
      const el2 = document.createElement(tag2);
      container.appendChild(el1);
      container.appendChild(el2);

      await inflictBoreDOM({}, undefined, { debug: false });
      await new Promise(r => setTimeout(r, 50));

      expect(el1.textContent).to.contain("One");
      expect(el2.textContent).to.contain("Two");
    });

    it("should auto-wrap raw init functions", async () => {
       const tagName = "auto-wrap-test";
       const template = document.createElement("template");
       template.setAttribute("data-component", tagName);
       template.innerHTML = `
         <span>Result: <slot name="val"></slot></span>
         <script type="module">
           // This is NOT wrapped in webComponent(), but just the init function
           export default ({ state }) => {
              return ({ slots }) => {
                slots.val = state.val;
              }
           }
         </script>
       `;
       document.body.appendChild(template);
       
       const el = document.createElement(tagName);
       container.appendChild(el);
       
       await inflictBoreDOM({ val: "worked" });
       await new Promise(r => setTimeout(r, 50));
       
       expect(el.textContent).to.contain("Result: worked");
    });
  });
};
