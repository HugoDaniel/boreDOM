
import { expect } from "chai";
import { startAuto, resetAutoStart } from "./auto-start";

export default function inlineLogicTests() {
  describe("Inline Logic Components", () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      resetAutoStart();
    });

    afterEach(() => {
      document.body.removeChild(container);
      // Clean up registered components if possible, or just ignore since browser tests refresh
    });

    it("should load component logic from triplet scripts", async () => {
      // 1. Setup HTML
      const tagName = "inline-counter";
      
      // Inject the template with script into DOM
      const template = document.createElement("template");
      template.setAttribute("data-component", tagName);
      // Light DOM (default for boreDOM tests)
      
      // We construct the innerHTML carefully
      template.innerHTML = `
        <div class="count">Count: <slot name="value">0</slot></div>
        <button data-dispatch="inc">+</button>
      `;
      
      container.appendChild(template);

      const script = document.createElement("script");
      script.type = "text/boredom";
      script.setAttribute("data-component", tagName);
      script.textContent = `
        export default ({ on }) => {
          on("inc", ({ state }) => {
            state.count++;
          });

          return ({ state, slots }) => {
            slots.value = String(state.count);
          };
        };
      `;
      container.appendChild(script);

      // Create an instance of the component
      const instance = document.createElement(tagName);
      container.appendChild(instance);

      // 2. Initialize boreDOM
      const state = await startAuto({ count: 10 });

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
      `;
      container.appendChild(t1);

      const s1 = document.createElement("script");
      s1.type = "text/boredom";
      s1.setAttribute("data-component", tag1);
      s1.textContent = `
        export default () => {
          return ({ slots }) => {
            slots.default = "One rendered";
          };
        };
      `;
      container.appendChild(s1);

      const t2 = document.createElement("template");
      t2.setAttribute("data-component", tag2);
      t2.innerHTML = `
        <span>Two</span>
      `;
      container.appendChild(t2);

      const s2 = document.createElement("script");
      s2.type = "text/boredom";
      s2.setAttribute("data-component", tag2);
      s2.textContent = `
        export default () => {
          return ({ slots }) => {
            slots.default = "Two rendered";
          };
        };
      `;
      container.appendChild(s2);

      const el1 = document.createElement(tag1);
      const el2 = document.createElement(tag2);
      container.appendChild(el1);
      container.appendChild(el2);

      await startAuto({});
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
       `;
       container.appendChild(template);

       const s3 = document.createElement("script");
       s3.type = "text/boredom";
       s3.setAttribute("data-component", tagName);
       s3.textContent = `
         export default ({ state }) => {
            return ({ slots }) => {
              slots.val = state.val;
            }
         }
       `;
       container.appendChild(s3);
       
       const el = document.createElement(tagName);
       container.appendChild(el);
       
       await startAuto({ val: "worked" });
       await new Promise(r => setTimeout(r, 50));
       
       expect(el.textContent).to.contain("Result: worked");
    });
  });
};
