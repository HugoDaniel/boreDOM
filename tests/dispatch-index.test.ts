import { expect } from "chai";
import { inflictBoreDOM, webComponent } from "../src/index";
import { fireEvent } from "@testing-library/dom";

async function frame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((t) => resolve(t));
  });
}

function renderHTML(html: string) {
  const main = document.querySelector("main");
  if (!main) throw new Error("No <main> found!");
  main.innerHTML = html;
  return main;
}

export default function dispatchIndexTests() {
  describe("Dispatch & Indexing", () => {
    beforeEach(() => {
      const main = document.querySelector("main");
      if (main) main.innerHTML = "";
    });

    it("should update state via direct ref onclick (Singular Approach)", async () => {
      renderHTML(`
        <ref-comp></ref-comp>
        <template data-component="ref-comp">
          <button data-ref="btn">Click</button>
          <span data-ref="out"></span>
          <script type="module">
            export default ({ refs, state }) => {
              refs.btn.onclick = () => state.val = 'ok';
              return ({ state, refs }) => {
                refs.out.textContent = state.val;
              };
            }
          </script>
        </template>
      `);
      
      const state = await inflictBoreDOM({ val: 'init' });
      const btn = document.querySelector('button');
      if (!btn) throw new Error("Button not found");
      
      fireEvent.click(btn);
      await frame();
      
      const out = document.querySelector('[data-ref="out"]');
      expect(out?.textContent).to.equal('ok');
    });

    it("should provide the correct index in dispatch handlers (List Approach)", async () => {
      renderHTML(`
        <list-comp></list-comp>
        <template data-component="list-comp">
          <div data-ref="container"></div>
          <script type="module">
            export default ({ on, state, makeComponent, refs }) => {
              on('hit', ({ e }) => {
                state.lastIndex = e.index;
              });
              return ({ state, refs }) => {
                refs.container.innerHTML = '';
                [0, 1, 2].forEach(() => {
                  refs.container.appendChild(makeComponent('item-btn'));
                });
              };
            }
          </script>
        </template>
        <template data-component="item-btn">
          <button onclick="dispatch('hit')">Hit</button>
        </template>
      `);
      
      const state = await inflictBoreDOM({ lastIndex: -1 });
      await frame(); // Wait for initial render of children
      
      const buttons = document.querySelectorAll('button');
      expect(buttons.length).to.equal(3);
      
      fireEvent.click(buttons[1]); // Click the second button
      await frame();
      
      expect(state.lastIndex).to.equal(1);
    });
  });
}