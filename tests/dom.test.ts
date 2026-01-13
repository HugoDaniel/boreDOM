import "chai/chai.js";
import { expect } from "chai";
import {
  fireEvent,
  getByLabelText,
  getByRole,
  getByText,
  queryAllByLabelText,
  queryByLabelText,
  queryByText,
} from "@testing-library/dom";
import "mocha/mocha.js";
import { inflictBoreDOM, webComponent } from "../src/index";
import { flatten } from "../src/utils/flatten";
import { access } from "../src/utils/access";
import { isPOJO } from "../src/utils/isPojo";

function renderHTML(html: string) {
  const main = document.querySelector("main");
  if (!main) throw new Error("No <main> found!");
  main.innerHTML = html;
  return main;
}

async function frame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((t) => resolve(t));
  });
}

async function renderHTMLFrame(html: string): Promise<HTMLElement> {
  const main = document.querySelector("main");
  if (!main) throw new Error("No <main> found!");
  main.innerHTML = html;
  return (new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve(main);
    });
  }));
}

export default function () {
  describe("DOM", () => {
    beforeEach(function () {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = "";
    });

    describe("Simple component", () => {
      it("should register the <template> data-component tag", async () => {
        const container = renderHTML(
          `<template data-component="simple-component"></template>`,
        );
        inflictBoreDOM();

        const ctor = customElements.get("simple-component");

        expect(ctor).not.to.be.undefined;
        if (!ctor) throw new Error("Undefined tag");
        expect(new ctor()).to.be.an.instanceof(HTMLElement);
      });

      it("should not register the <template> data-component tag if it is invalid", async () => {
        const container = renderHTML(
          `<template data-component="nonvalid"></template>`,
        );
        inflictBoreDOM();

        const ctor = customElements.get("nonvalid");

        expect(ctor).to.be.undefined;
      });

      it("should render the html of the custom element", async () => {
        const container = renderHTML(`
          <simple-component2></simple-component2>
          <template data-component="simple-component2"><p>This is some random HTML</p></template>
        `);
        inflictBoreDOM();

        const elem = getByText(container, "This is some random HTML");
        expect(elem).to.be.an.instanceof(HTMLParagraphElement);
      });

      it("should render in shadow root the html of the corresponding <template> tag when it has shadowmode set", async () => {
        const container = renderHTML(`
          <simple-component3></simple-component3>
          <template data-component="simple-component3" shadowrootmode="open"><p>Test</p></template>
        `);
        inflictBoreDOM();

        const elem = getByText(
          (container.firstElementChild as any).shadowRoot,
          "Test",
        );
        expect(elem).to.be.an.instanceof(HTMLParagraphElement);
      });

      it("should apply the aria attributes from the <template> to the tag of the custom element", async () => {
        const container = renderHTML(`
          <simple-component4></simple-component4>
          <template data-component="simple-component4" data-aria-label="Some Label"><p>Something</p></template>
        `);
        inflictBoreDOM();

        const elem = getByLabelText(container, "Some Label");
        expect(elem).to.be.an.instanceof(HTMLElement);
        expect(elem.tagName).to.equal("SIMPLE-COMPONENT4");
        expect(elem.firstChild).to.be.an.instanceof(HTMLParagraphElement);
      });

      it("should apply the role attribute from the <template> to the tag of the custom element", async () => {
        const container = renderHTML(`
          <simple-component5></simple-component5>
          <template data-component="simple-component5" data-role="banner"><p>Something</p></template>
        `);
        inflictBoreDOM();

        const elem = getByRole(container, "banner");
        expect(elem).to.be.an.instanceof(HTMLElement);
        expect(elem.tagName).to.equal("SIMPLE-COMPONENT5");
        expect(elem.firstChild).to.be.an.instanceof(HTMLParagraphElement);
      });

      it("should allow the slots default behaviour", async () => {
        const container = await renderHTMLFrame(`
          <slotted-component1>
            <span slot="my-text">Let's have some different text!</span>
          </slotted-component1>

          <template data-component="slotted-component1" shadowrootmode="open">
            <p><slot name="my-text">My default text</slot></p>
          </template>
        `);

        await inflictBoreDOM(); // replacing slots requires "shadowrootmode" to be set
        const elem = getByText(
          container,
          "Let's have some different text!",
        );
        expect(elem).to.be.an.instanceof(HTMLElement);

        const shouldNotExist = queryByText(
          container,
          "My default text",
        );
        expect(shouldNotExist).to.be.null;
      });
    });
    describe("Simple component events", () => {
      it("should set a data-event-dispatches on the web component once the custom event is registered", () => {
        const container = renderHTML(`
          <eventful-component1></eventful-component1>
          <template data-component="eventful-component1"><button onclick="dispatch('clickme')">Click me</button></template>
        `);
        inflictBoreDOM();

        const elem = container.querySelector(
          "[data-onclick-dispatches]",
        ) as HTMLElement;
        expect(elem).to.be.an.instanceof(HTMLElement);
        expect(elem.dataset.onclickDispatches).to.eql("clickme");
      });

      it("should dispatch a custom event with the provided name in the dispatch function", async (done) => {
        const container = renderHTML(`
          <eventful-component2></eventful-component2>
          <template data-component="eventful-component2"><button onclick="dispatch('clickme')">Click me</button></template>
        `);
        inflictBoreDOM();

        addEventListener("clickme", (e: any) => {
          expect(e.detail.event).not.to.be.undefined;
          expect(e.detail.event.target).to.be.an.instanceof(HTMLElement);
          if (!(e.detail.event.target instanceof HTMLElement)) {
            throw new Error("Event target not an html element");
          }
          expect(e.detail.event.target.tagName.toLowerCase()).to.equal(
            "button",
          );
          done();
        });

        const elem = getByText(
          container,
          "Click me",
        );
        fireEvent.click(elem);
      });

      it("should dispatch more than one custom event when more than one string is in the dispatch function", async (done) => {
        const container = renderHTML(`
          <eventful-component3></eventful-component3>
          <template data-component="eventful-component3"><button onclick="dispatch('clickyou', 'clickthem')">Click me</button></template>
        `);
        inflictBoreDOM();

        let triggeredEvents: string[] = [];
        addEventListener("clickthem", (e: any) => {
          expect(e.detail.event).not.to.be.undefined;
          expect(e.detail.event.target).to.be.an.instanceof(HTMLElement);
          if (!(e.detail.event.target instanceof HTMLElement)) {
            throw new Error("Event target not an html element");
          }
          expect(e.detail.event.target.tagName.toLowerCase()).to.equal(
            "button",
          );

          triggeredEvents.push("clickthem");
          if (triggeredEvents.includes("clickyou")) {
            done();
          }
        });

        addEventListener("clickyou", (e: any) => {
          expect(e.detail.event).not.to.be.undefined;
          expect(e.detail.event.target).to.be.an.instanceof(HTMLElement);
          if (!(e.detail.event.target instanceof HTMLElement)) {
            throw new Error("Event target not an html element");
          }
          expect(e.detail.event.target.tagName.toLowerCase()).to.equal(
            "button",
          );

          triggeredEvents.push("clickyou");
          if (triggeredEvents.includes("clickthem")) {
            done();
          }
        });

        const elem = getByText(
          container,
          "Click me",
        );
        // One click, should trigger two custom events
        fireEvent.click(elem);
      });
    });

    describe("Component with <script> code", () => {
      it("should load the associated JS and run the render function", async () => {
        // The following code is accompanied by the `stateful-component1.js` file.
        const container = renderHTML(`
          <stateful-component1></stateful-component1>

          <template data-component="stateful-component1">
            <p>Stateful component 1</p>
          </template>

          <script src="/stateful-component1.js"></script>
        `);
        // The `stateful-component1.js` should be automatically imported dynamically and
        // its render function called.
        await inflictBoreDOM();

        const elem = getByText(
          container,
          "Render",
        );
        expect(elem).to.be.an.instanceof(HTMLParagraphElement);
      });

      it("should pass refs through an object in init", async () => {
        // The following code is accompanied by the `stateful-component2.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component2></stateful-component2>

          <template data-component="stateful-component2">
            <p>Some ref:
              <span data-ref="something"> </span> </p>
            <!-- ^ should be available as options.refs.something in the init function -->
          </template>

          <script src="/stateful-component2.js"></script>
        `);

        await inflictBoreDOM(); // Runs the code in `stateful-component2.js`

        const elem = getByText(
          container,
          "Something ref innerText updated",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
      });

      it("should throw an error when an undefined ref is being accessed", async () => {
        // The following code is accompanied by the `stateful-component3.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component3></stateful-component3>

          <template data-component="stateful-component3"></template>

          <script src="/stateful-component3.js"></script>
        `);

        try {
          await inflictBoreDOM(); // Runs the code in `stateful-component3.js`
        } catch (e) {
          expect((e as Error).message).to.be.a.string(
            'Ref "somethingThatDoesNotExist" not found in <STATEFUL-COMPONENT3>',
          );
        }
      });

      it("should be able to get slots through the `slots` object property in the render function", async () => {
        // The following code is accompanied by the `stateful-component4.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component4></stateful-component4>

          <template data-component="stateful-component4">
            <p>Something can be placed below:</p>
            <slot name="some-slot"></slot>
            <!-- ^ should be available as options.slots["some-slot"] in the render function -->
          </template>

          <script src="/stateful-component4.js"></script>

          <template data-component="stateful-component4b">
            <p>This component will be placed in the slot by the .js code</p>
          </template>
        `);

        await inflictBoreDOM(); // Runs the code in `stateful-component4.js`

        const elem = getByText(
          container,
          "This component will be placed in the slot by the .js code",
        );
        expect(elem).to.be.an.instanceof(HTMLParagraphElement);
      });

      it("should be able to set slots through the `slots` object property and replace the slot element", async () => {
        // The following code is accompanied by the `stateful-component5.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component5></stateful-component5>

          <template data-component="stateful-component5">
            <p>Something can be placed below:</p>
            <slot name="some-slot">This will be replaced</slot>
            <!-- ^ should be available to be replaced by setting options.slots["some-slot"] in the render function -->
          </template>

          <script src="/stateful-component5.js"></script>
        `);

        await inflictBoreDOM(); // Runs the code in `stateful-component5.js`

        const replaced = queryByText(
          container,
          "This will be replaced",
        );
        expect(replaced).to.be.null;

        const elem = getByText(
          container,
          "Text in a paragraph that replaced the slot",
        );
        expect(elem).to.be.an.instanceof(HTMLParagraphElement);
      });

      it("should place the slot name in a data attribute of the element that replaces it", async () => {
        // The following code is accompanied by the `stateful-component5.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component5></stateful-component5>

          <template data-component="stateful-component5">
            <p>Something can be placed below:</p>
            <slot name="some-slot">This will be replaced</slot>
            <!-- ^ should be available to be replaced by setting options.slots["some-slot"] in the render function -->
          </template>

          <script src="/stateful-component5.js"></script>
        `);

        await inflictBoreDOM(); // Runs the code in `stateful-component5.js`

        const elem = getByText(
          container,
          "Text in a paragraph that replaced the slot",
        );
        expect(elem.dataset.slot).to.be.string(
          "some-slot",
          "Should have a `data-slot='slot-name' attribute`",
        );
      });

      it("should allow script code to be defined in the `inflictBoreDOM()` function", async () => {
        const container = renderHTML(`
          <inline-component1></inline-component1>

          <template data-component="inline-component1">
            <p>Stateful inline component 1</p>
          </template>

          <!-- code will be set in inflictBoreDOM -->
        `);

        await inflictBoreDOM(undefined, {
          "inline-component1": webComponent(() => ({ self }) => {
            self.innerHTML = "Inline code run";
          }),
        });

        const elem = getByText(
          container,
          "Inline code run",
        );
        expect(elem).to.be.an.instanceof(HTMLElement);
        expect(elem.tagName).to.be.equals("INLINE-COMPONENT1");
      });

      it("should initialize all instances of the same component", async () => {
        const container = await renderHTMLFrame(`
          <multi-instance-component></multi-instance-component>
          <multi-instance-component></multi-instance-component>

          <template data-component="multi-instance-component">
            <p>Multi instance component</p>
          </template>

          <script src="/multi-instance-component.js"></script>
        `);

        await inflictBoreDOM();

        const instances = Array.from(
          container.querySelectorAll("multi-instance-component"),
        );

        expect(instances.length).to.equal(2);
        expect(instances[0]).to.be.an.instanceof(HTMLElement);
        expect(instances[1]).to.be.an.instanceof(HTMLElement);

        // Both instances should have been initialized with their index
        expect(instances[0].getAttribute("data-index")).to.equal("0");
        expect(instances[1].getAttribute("data-index")).to.equal("1");
      });
    });

    describe("Event handlers in scripts", () => {
      it(
        "should handle custom events with the provided 'on' function",
        function (done) {
          (async () => {
            // The following code is accompanied by the `stateful-component5.js` file.
            const container = await renderHTMLFrame(`
          <on-event-component1></on-event-component1>

          <template data-component="on-event-component1">
            <button onclick="dispatch('someCustomEventOnClick')">Click here to dispatch</butbbon>
          </template>
          <script src="/on-event-component1.js"></script>
        `);

            const state = { onDone: done };

            await inflictBoreDOM(state);

            const elem = getByText(
              container,
              "Click here to dispatch",
            );

            // One click, should trigger the custom event, and call the registered callbackes
            // provided to the 'on' function (see 'on-event-component1.js')
            fireEvent.click(elem);
          })();
        },
      );

      it(
        "should be able to update the state and automatically render in the provided 'on' function",
        async () => {
          // The following code is accompanied by the `stateful-component5.js` file.
          const container = await renderHTMLFrame(`
          <on-event-component2></on-event-component2>

          <template data-component="on-event-component2">
            <p data-ref="label">Value</p>
            <button onclick="dispatch('incrementClick')">Increment</button>
          </template>
          <script src="/on-event-component2.js"></script>
        `);

          const state = { value: 0 };

          await inflictBoreDOM(state);

          // Label should be "0", because the "value" attribute is being set on render:
          const labelElem = getByText(
            container,
            "0",
          );

          const btn = getByText(
            container,
            "Increment",
          );

          // One click, should trigger the custom event, and call the registered callbackes
          // provided to the 'on' function (see 'on-event-component1.js')
          fireEvent.click(btn);

          await frame();

          const newLabelElem = getByText(
            container,
            "1",
          );
          expect(newLabelElem.innerText).to.be.string("1");
        },
      );
    });

    describe("State in component <script> code", () => {
      it("should pass the provided state ", async () => {
        // The following code is accompanied by the `stateful-component6.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component6></stateful-component6>

          <template data-component="stateful-component6">
            <p>Initial state is: <span data-ref="container"></span></p>
          </template>

          <script src="/stateful-component6.js"></script>
        `);

        await inflictBoreDOM({ content: { value: "Initial state" } }); // Runs the code in `stateful-component6.js`

        const elem = getByText(
          container,
          "Initial state",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
      });

      it("should re-render when the provided state has changed", async () => {
        // The following code is accompanied by the `stateful-component6.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component6></stateful-component6>

          <template data-component="stateful-component6">
            <p>Initial state is: <span data-ref="container"></span></p>
          </template>

          <script src="/stateful-component6.js"></script>
        `);

        const state = { content: { value: "Initial state" } };
        await inflictBoreDOM(state); // Runs the code in `stateful-component6.js`

        // Update the state:
        state.content.value = "This is new content";

        await frame();

        const elem = getByText(
          container,
          "This is new content",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
      });

      it("should re-render when an array changed in the provided state", async () => {
        // The following code is accompanied by the `stateful-component6.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component7></stateful-component7>

          <template data-component="stateful-component7">
            <p>Initial state is: <span data-ref="container"></span></p>
          </template>

          <script src="/stateful-component7.js"></script>
        `);

        const state = { content: { value: ["Initial state"] } };
        await inflictBoreDOM(state); // Runs the code in `stateful-component7.js`

        // Update the state:
        state.content.value[0] = "This is new content";

        await frame();

        const elem = getByText(
          container,
          "This is new content",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
      });

      it("should re-render when an array changed in an event handler", async () => {
        // The following code is accompanied by the `stateful-component6.js` file.
        const container = await renderHTMLFrame(`
          <stateful-component8></stateful-component8>

          <template data-component="stateful-component8">
            <button onclick="dispatch('update')">Click to update</button>
            <p>Initial state is: <span data-ref="container"></span></p>
          </template>

          <script src="/stateful-component8.js"></script>
        `);

        const state = { content: { value: ["Initial state"] } };
        await inflictBoreDOM(state); // Runs the code in `stateful-component8.js`

        const btn = getByText(
          container,
          "Click to update",
        );

        fireEvent.click(btn);

        await frame();

        const elem = getByText(
          container,
          "This is new content",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
      });

      it("should re-render when state changes in an async event handler", async () => {
        const container = await renderHTMLFrame(`
          <stateful-component9></stateful-component9>

          <template data-component="stateful-component9">
            <button onclick="dispatch('update')">Click to update</button>
            <p>Initial state is: <span data-ref="container"></span></p>
          </template>

          <script src="/stateful-component9.js"></script>
        `);

        const state = { content: { value: "Initial state" } };
        await inflictBoreDOM(state);

        const btn = getByText(
          container,
          "Click to update",
        );

        fireEvent.click(btn);

        // Wait for async handler (Promise.resolve microtask) + rAF for re-render
        await frame();
        await frame();

        const elem = getByText(
          container,
          "This is async content",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
      });

      it("should re-render when nested objects are replaced in the state", async () => {
        const container = await renderHTMLFrame(`
          <stateful-component10></stateful-component10>

          <template data-component="stateful-component10">
            <span data-ref="value"></span>
          </template>

          <script src="/stateful-component10.js"></script>
        `);

        const state = { content: { nested: { value: "initial" } } };
        await inflictBoreDOM(state);

        state.content.nested = { value: "updated" };

        await frame();

        const elem = getByText(
          container,
          "updated",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
      });

      it("should re-render nested updates gated behind an unrelated flag", async () => {
        const container = await renderHTMLFrame(`
          <stateful-component11></stateful-component11>

          <template data-component="stateful-component11">
            <p data-ref="info"></p>
          </template>

          <script src="/stateful-component11.js"></script>
        `);

        const state = {
          gpu: {
            isReady: false,
            info: { adapter: "none", device: "none" },
          },
        };
        await inflictBoreDOM(state);

        state.gpu.info = { adapter: "Ada", device: "RTX" };

        await frame();

        // No update yet because the render only runs when isReady flips
        let elem = queryByText(container, "Adapter: Ada | Device: RTX");
        expect(elem).to.be.null;

        state.gpu.isReady = true;

        await frame();

        elem = getByText(container, "Adapter: Ada | Device: RTX");
        expect(elem).to.be.an.instanceof(HTMLParagraphElement);
      });
    });

    describe("Multi-hyphen component names", () => {
      it("should correctly match scripts when component names share prefixes", async () => {
        // This test verifies that multi-hyphen-component loads multi-hyphen-component.js
        // and multi-hyphen-component-extra loads multi-hyphen-component-extra.js
        // The bug: script[src*="multi-hyphen-component"] matches BOTH scripts
        const container = await renderHTMLFrame(`
          <multi-hyphen-component></multi-hyphen-component>
          <multi-hyphen-component-extra></multi-hyphen-component-extra>

          <template data-component="multi-hyphen-component">
            <p>Short name component</p>
          </template>

          <template data-component="multi-hyphen-component-extra">
            <p>Long name component</p>
          </template>

          <!-- Order matters for reproducing the bug - longer name first -->
          <script src="/multi-hyphen-component-extra.js"></script>
          <script src="/multi-hyphen-component.js"></script>
        `);

        await inflictBoreDOM();

        const shortComponent = container.querySelector("multi-hyphen-component");
        const longComponent = container.querySelector("multi-hyphen-component-extra");

        // Each component should have loaded its OWN script, not the other's
        expect(shortComponent?.getAttribute("data-loaded")).to.equal(
          "multi-hyphen-component",
          "multi-hyphen-component should load multi-hyphen-component.js, not the -extra version"
        );
        expect(longComponent?.getAttribute("data-loaded")).to.equal(
          "multi-hyphen-component-extra",
          "multi-hyphen-component-extra should load multi-hyphen-component-extra.js"
        );
      });

      it("should handle three-hyphen component names", async () => {
        const container = await renderHTMLFrame(`
          <my-super-cool-component></my-super-cool-component>

          <template data-component="my-super-cool-component">
            <p>Three hyphen component</p>
          </template>
        `);

        await inflictBoreDOM();

        const elem = container.querySelector("my-super-cool-component");
        expect(elem).to.be.an.instanceof(HTMLElement);
        expect(elem?.querySelector("p")?.textContent).to.equal("Three hyphen component");
      });
    });

    describe("Lists of components in <script> code", () => {
      it("should be able to dynamically create a component with a detail object", async () => {
        // The following code is accompanied by the `list-component1.js` file.
        const container = await renderHTMLFrame(`
          <list-component1></list-component1>

          <template data-component="list-component1">
            <p>Below will be added a dynamic component</p>
            <ol>
            </ol>
          </template>
          <script src="/list-component1.js"></script>

          <template data-component="list-item1">
            <li></li>
          </template>
          <script src="/list-item1.js"></script>
        `);

        await frame();

        await inflictBoreDOM({ content: { items: ["some item"] } }); // Runs the code in `list-component1.js`

        const elem = getByText(
          container,
          "some item",
        );
        expect(elem).to.be.an.instanceof(HTMLElement);
      });

      it("should dynamically create multiple components", async () => {
        // The following code is accompanied by the `list-component1.js` file.
        // This is the same as the previous test
        const container = await renderHTMLFrame(`
          <list-component1></list-component1>

          <template data-component="list-component1">
            <p>Below will be added a dynamic component</p>
            <ol>
            </ol>
          </template>
          <script src="/list-component1.js"></script>

          <template data-component="list-item1">
            <li></li>
          </template>
          <script src="/list-item1.js"></script>
        `);

        await frame();

        // In this test, pass multiple items in the array
        await inflictBoreDOM({
          content: { items: ["item A", "item B", "item C"] },
        });
        //    ^ Runs the code in `list-component1.js`
        const elem1 = getByText(
          container,
          "item A",
        );
        const elem2 = getByText(
          container,
          "item B",
        );
        const elem3 = getByText(
          container,
          "item C",
        );
        expect(elem1).to.be.an.instanceof(HTMLElement);
        expect(elem2).to.be.an.instanceof(HTMLElement);
        expect(elem3).to.be.an.instanceof(HTMLElement);
      });
    });

    describe("Proxy internals", () => {
      describe("Mutation batching", () => {
        it("should batch multiple synchronous mutations into a single render", async () => {
          const container = await renderHTMLFrame(`
            <batching-component></batching-component>

            <template data-component="batching-component">
              <p>Batching test</p>
            </template>

            <script src="/batching-component.js"></script>
          `);

          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({ a: 0, b: 0, c: 0 });

          const elem = container.querySelector("batching-component") as HTMLElement;
          const initialRenderCount = elem.getAttribute("data-render-count");
          expect(initialRenderCount).to.equal("1");

          // Multiple synchronous mutations
          state.a = 1;
          state.b = 2;
          state.c = 3;

          // Before frame, render count should still be 1
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          await frame();

          // After frame, should have rendered only once more (batched)
          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-values")).to.equal("1,2,3");
        });

        it("should batch mutations across different paths into single render", async () => {
          const container = await renderHTMLFrame(`
            <batching-component></batching-component>

            <template data-component="batching-component">
              <p>Batching test</p>
            </template>

            <script src="/batching-component.js"></script>
          `);

          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({ a: 0, b: 0, c: 0 });

          const elem = container.querySelector("batching-component") as HTMLElement;

          // Mutate in rapid succession
          for (let i = 0; i < 10; i++) {
            state.a = i;
          }

          await frame();

          // Should only have 2 renders: initial + 1 batched
          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-values")).to.equal("9,0,0");
        });
      });

      describe("Read-only state in render", () => {
        it("should block mutations to state within render function", async () => {
          const errors: any[] = [];
          const originalError = console.error;
          console.error = (...args: any[]) => {
            errors.push(args);
            originalError.apply(console, args);
          };

          const container = await renderHTMLFrame(`
            <readonly-state-component></readonly-state-component>

            <template data-component="readonly-state-component">
              <p>Read-only test</p>
            </template>

            <script src="/readonly-state-component.js"></script>
          `);

          const state = { value: "original" };
          await inflictBoreDOM(state);

          console.error = originalError;

          // Should have logged an error about read-only state
          const readOnlyErrors = errors.filter(
            (e) => e[0] && typeof e[0] === "string" && e[0].includes("read-only"),
          );
          expect(readOnlyErrors.length).to.be.greaterThan(0);

          // State should remain unchanged
          expect(state.value).to.equal("original");

          // Component should display original value
          const elem = container.querySelector("readonly-state-component") as HTMLElement;
          expect(elem.getAttribute("data-value")).to.equal("original");
        });
      });

      describe("Symbol key bypass", () => {
        it("should not trigger re-render when Symbol key is mutated", async () => {
          const container = await renderHTMLFrame(`
            <symbol-key-component></symbol-key-component>

            <template data-component="symbol-key-component">
              <p>Symbol key test</p>
            </template>

            <script src="/symbol-key-component.js"></script>
          `);

          const RUNTIME = Symbol("runtime");
          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({ count: 0, [RUNTIME]: { hidden: "initial" } }) as any;

          const elem = container.querySelector("symbol-key-component") as HTMLElement;
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          // Mutate Symbol key - should NOT trigger re-render
          state[RUNTIME].hidden = "changed";
          state[RUNTIME] = { hidden: "replaced" };

          await frame();

          // Render count should still be 1
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          // Now mutate a regular key - SHOULD trigger re-render
          state.count = 1;

          await frame();

          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-count")).to.equal("1");
        });
      });

      describe("Hierarchical subscription matching", () => {
        it("should re-render parent subscriber when child path changes", async () => {
          const container = await renderHTMLFrame(`
            <hierarchical-parent-component></hierarchical-parent-component>

            <template data-component="hierarchical-parent-component">
              <p>Parent subscriber</p>
            </template>

            <script src="/hierarchical-parent-component.js"></script>
          `);

          const state = { user: { name: "Alice", email: "alice@test.com" } };
          await inflictBoreDOM(state);

          const elem = container.querySelector("hierarchical-parent-component") as HTMLElement;
          expect(elem.getAttribute("data-render-count")).to.equal("1");
          expect(elem.getAttribute("data-user-name")).to.equal("Alice");

          // Change a child path (user.name) - parent subscribed to "user" should re-render
          state.user.name = "Bob";

          await frame();

          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-user-name")).to.equal("Bob");
        });

        it("should re-render child subscriber when parent object property changes", async () => {
          const container = await renderHTMLFrame(`
            <hierarchical-child-component></hierarchical-child-component>

            <template data-component="hierarchical-child-component">
              <p>Child subscriber</p>
            </template>

            <script src="/hierarchical-child-component.js"></script>
          `);

          const state = { user: { name: "Alice", email: "alice@test.com" } };
          await inflictBoreDOM(state);

          const elem = container.querySelector("hierarchical-child-component") as HTMLElement;
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          // Change sibling path (user.email) - child subscribed to "user.name"
          // This tests if changing user.email triggers user.name subscriber
          state.user.email = "alice2@test.com";

          await frame();

          // Child subscribed to user.name should NOT re-render for user.email change
          // (they are siblings, not hierarchical)
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          // Now change the actual subscribed path
          state.user.name = "Carol";

          await frame();

          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-name")).to.equal("Carol");
        });
      });

      describe("Object replacement", () => {
        it("should re-render when a nested object is replaced", async () => {
          const container = await renderHTMLFrame(`
            <object-replacement-component></object-replacement-component>

            <template data-component="object-replacement-component">
              <p>Object replacement test</p>
            </template>

            <script src="/object-replacement-component.js"></script>
          `);

          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({ user: { name: "Alice", email: "alice@test.com" } });

          const elem = container.querySelector("object-replacement-component") as HTMLElement;
          expect(elem.getAttribute("data-render-count")).to.equal("1");
          expect(elem.getAttribute("data-name")).to.equal("Alice");

          // Replace the entire nested object - goes through proxy
          state.user = { name: "Bob", email: "bob@test.com" };

          await frame();

          // Should have re-rendered with new values
          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-name")).to.equal("Bob");
          expect(elem.getAttribute("data-email")).to.equal("bob@test.com");
        });

        it("should continue to be reactive after object replacement", async () => {
          const container = await renderHTMLFrame(`
            <new-object-reactivity-component></new-object-reactivity-component>

            <template data-component="new-object-reactivity-component">
              <p>New object reactivity test</p>
            </template>

            <script src="/new-object-reactivity-component.js"></script>
          `);

          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({
            user: { name: "Alice", email: "alice@test.com" },
            data: { level1: { level2: { level3: { value: "initial" } } } },
            items: ["a", "b"],
          }) as any;

          const elem = container.querySelector("new-object-reactivity-component") as HTMLElement;
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          // Replace object - goes through proxy, new object gets proxified
          state.user = { name: "Bob", email: "bob@test.com" };
          await frame();

          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-user-name")).to.equal("Bob");

          // Mutate the NEW object - should trigger re-render
          state.user.name = "Carol";
          await frame();

          expect(elem.getAttribute("data-render-count")).to.equal("3");
          expect(elem.getAttribute("data-user-name")).to.equal("Carol");
        });

        it("should proxify deeply nested new objects", async () => {
          // Use unique tag name to avoid conflicts with other tests
          const container = await renderHTMLFrame(`
            <deep-object-test></deep-object-test>

            <template data-component="deep-object-test">
              <p>Deep object test</p>
            </template>
          `);

          // Use inline component logic (same module as test) to avoid dual-module issues
          let deepRenderCount = 0;
          const deepObjectComponent = webComponent(() => {
            return ({ self, state }: any) => {
              deepRenderCount++;
              self.setAttribute("data-render-count", String(deepRenderCount));
              self.setAttribute("data-deep-value", state.data?.level1?.level2?.level3?.value ?? "none");
            };
          });

          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({
            user: { name: "Alice" },
            data: {},
            items: [],
          }, {
            "deep-object-test": deepObjectComponent,
          }) as any;

          const elem = container.querySelector("deep-object-test") as HTMLElement;
          await frame(); // Ensure initial render completes
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          // Replace with deeply nested object - goes through proxy
          state.data = {
            level1: {
              level2: {
                level3: { value: "deep" },
              },
            },
          };
          await frame();
          await frame(); // Extra frame for re-render

          expect(elem.getAttribute("data-render-count")).to.equal("2");
          expect(elem.getAttribute("data-deep-value")).to.equal("deep");

          // Mutate deep inside the new object
          state.data.level1.level2.level3.value = "mutated deep";
          await frame();
          await frame();

          expect(elem.getAttribute("data-render-count")).to.equal("3");
          expect(elem.getAttribute("data-deep-value")).to.equal("mutated deep");
        });

        it("should proxify new arrays on replacement", async () => {
          // Use unique tag name to avoid conflicts with other tests
          const container = await renderHTMLFrame(`
            <array-replace-test></array-replace-test>

            <template data-component="array-replace-test">
              <p>Array replacement test</p>
            </template>
          `);

          // Use inline component logic (same module as test) to avoid dual-module issues
          let arrayRenderCount = 0;
          const arrayReplaceComponent = webComponent(() => {
            return ({ self, state }: any) => {
              arrayRenderCount++;
              self.setAttribute("data-render-count", String(arrayRenderCount));
              self.setAttribute("data-items", state.items?.join(",") ?? "none");
            };
          });

          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({
            user: { name: "Alice" },
            data: {},
            items: ["old1", "old2"],
          }, {
            "array-replace-test": arrayReplaceComponent,
          }) as any;

          const elem = container.querySelector("array-replace-test") as HTMLElement;
          await frame(); // Ensure initial render completes
          expect(elem.getAttribute("data-items")).to.equal("old1,old2");

          // Replace array - goes through proxy
          state.items = ["new1", "new2", "new3"];
          await frame();
          await frame(); // Extra frame for re-render

          expect(elem.getAttribute("data-items")).to.equal("new1,new2,new3");

          // Mutate the new array by index
          state.items[0] = "mutated";
          await frame();
          await frame();

          expect(elem.getAttribute("data-items")).to.equal("mutated,new2,new3");

          // Push to the new array
          state.items.push("pushed");
          await frame();
          await frame();

          expect(elem.getAttribute("data-items")).to.equal("mutated,new2,new3,pushed");
        });

        it("should proxify dynamically added nested objects", async () => {
          // Use unique tag name to avoid conflicts with other tests
          const container = await renderHTMLFrame(`
            <dynamic-nested-test></dynamic-nested-test>

            <template data-component="dynamic-nested-test">
              <p>Dynamic nested test</p>
            </template>
          `);

          // Use inline component logic (same module as test) to avoid dual-module issues
          let dynamicRenderCount = 0;
          const dynamicNestedComponent = webComponent(() => {
            return ({ self, state }: any) => {
              dynamicRenderCount++;
              self.setAttribute("data-render-count", String(dynamicRenderCount));
              self.setAttribute("data-profile-bio", state.user?.profile?.bio ?? "none");
            };
          });

          // Use the returned proxy for mutations (top-level props need proxy access)
          const state = await inflictBoreDOM({
            user: { name: "Alice" },
            data: {},
            items: [],
          }, {
            "dynamic-nested-test": dynamicNestedComponent,
          }) as any;

          const elem = container.querySelector("dynamic-nested-test") as HTMLElement;
          expect(elem.getAttribute("data-profile-bio")).to.equal("none");

          // Add new nested object - goes through the user proxy
          state.user.profile = { bio: "Hello", age: 25 };
          await frame();
          await frame(); // Extra frame for re-render

          expect(elem.getAttribute("data-profile-bio")).to.equal("Hello");

          // Mutate the dynamically added object
          state.user.profile.bio = "Updated bio";
          await frame();
          await frame();

          expect(elem.getAttribute("data-profile-bio")).to.equal("Updated bio");
        });
      });

      describe("Array methods reactivity", () => {
        it("should re-render when array.push() is called", async () => {
          const container = await renderHTMLFrame(`
            <array-methods-component></array-methods-component>

            <template data-component="array-methods-component">
              <button onclick="dispatch('push')">Push</button>
            </template>

            <script src="/array-methods-component.js"></script>
          `);

          const state = { items: ["a", "b"] };
          await inflictBoreDOM(state);

          const elem = container.querySelector("array-methods-component") as HTMLElement;
          expect(elem.getAttribute("data-items")).to.equal("a,b");
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          const btn = container.querySelector("button") as HTMLButtonElement;
          fireEvent.click(btn);

          await frame();

          expect(elem.getAttribute("data-items")).to.equal("a,b,new item");
          expect(elem.getAttribute("data-render-count")).to.equal("2");
        });

        it("should re-render when array.pop() is called", async () => {
          const container = await renderHTMLFrame(`
            <array-methods-component></array-methods-component>

            <template data-component="array-methods-component">
              <button onclick="dispatch('pop')">Pop</button>
            </template>

            <script src="/array-methods-component.js"></script>
          `);

          const state = { items: ["a", "b", "c"] };
          await inflictBoreDOM(state);

          const elem = container.querySelector("array-methods-component") as HTMLElement;
          expect(elem.getAttribute("data-items")).to.equal("a,b,c");

          const btn = container.querySelector("button") as HTMLButtonElement;
          fireEvent.click(btn);

          await frame();

          expect(elem.getAttribute("data-items")).to.equal("a,b");
        });

        it("should re-render when array.splice() is called", async () => {
          const container = await renderHTMLFrame(`
            <array-methods-component></array-methods-component>

            <template data-component="array-methods-component">
              <button onclick="dispatch('splice')">Splice</button>
            </template>

            <script src="/array-methods-component.js"></script>
          `);

          const state = { items: ["a", "b", "c"] };
          await inflictBoreDOM(state);

          const elem = container.querySelector("array-methods-component") as HTMLElement;
          expect(elem.getAttribute("data-items")).to.equal("a,b,c");

          const btn = container.querySelector("button") as HTMLButtonElement;
          fireEvent.click(btn);

          await frame();

          expect(elem.getAttribute("data-items")).to.equal("a,spliced,c");
        });

        it("should re-render when array index is directly set", async () => {
          const container = await renderHTMLFrame(`
            <array-methods-component></array-methods-component>

            <template data-component="array-methods-component">
              <p>Array test</p>
            </template>

            <script src="/array-methods-component.js"></script>
          `);

          const state = { items: ["a", "b", "c"] };
          await inflictBoreDOM(state);

          const elem = container.querySelector("array-methods-component") as HTMLElement;
          expect(elem.getAttribute("data-items")).to.equal("a,b,c");
          expect(elem.getAttribute("data-render-count")).to.equal("1");

          // Direct index assignment
          state.items[1] = "modified";

          await frame();

          expect(elem.getAttribute("data-items")).to.equal("a,modified,c");
          expect(elem.getAttribute("data-render-count")).to.equal("2");
        });
      });
    });

    describe("Refs edge cases", () => {
      it("should return an array when multiple elements share the same data-ref", async () => {
        const container = await renderHTMLFrame(`
          <multi-ref-component></multi-ref-component>

          <template data-component="multi-ref-component">
            <ul>
              <li data-ref="item">First</li>
              <li data-ref="item">Second</li>
              <li data-ref="item">Third</li>
            </ul>
          </template>

          <script src="/multi-ref-component.js"></script>
        `);

        await inflictBoreDOM();

        const elem = container.querySelector("multi-ref-component") as HTMLElement;
        expect(elem.getAttribute("data-ref-count")).to.equal("3");

        const items = elem.querySelectorAll("li");
        expect(items[0].textContent).to.equal("Item 0");
        expect(items[1].textContent).to.equal("Item 1");
        expect(items[2].textContent).to.equal("Item 2");
      });

      it("should return a single element when only one element has the data-ref", async () => {
        const container = await renderHTMLFrame(`
          <multi-ref-component></multi-ref-component>

          <template data-component="multi-ref-component">
            <ul>
              <li data-ref="item">Only one</li>
            </ul>
          </template>

          <script src="/multi-ref-component.js"></script>
        `);

        await inflictBoreDOM();

        const elem = container.querySelector("multi-ref-component") as HTMLElement;
        expect(elem.getAttribute("data-ref-count")).to.equal("1");

        const item = elem.querySelector("li");
        expect(item?.textContent).to.equal("Single item");
      });
    });

    describe("Slots edge cases", () => {
      it("should update slot content idempotently on multiple renders", async () => {
        const container = await renderHTMLFrame(`
          <slot-idempotent-component></slot-idempotent-component>

          <template data-component="slot-idempotent-component">
            <p><slot name="content">Default</slot></p>
          </template>
        `);

        await inflictBoreDOM(undefined, {
          "slot-idempotent-component": webComponent(() => {
            let renderCount = 0;
            return ({ slots, self }) => {
              renderCount++;
              (slots as any).content = `Render ${renderCount}`;
              self.setAttribute("data-render-count", String(renderCount));
            };
          }),
        });

        const elem = container.querySelector("slot-idempotent-component") as HTMLElement;
        expect(elem.getAttribute("data-render-count")).to.equal("1");

        // Query the slot content
        let slotContent = elem.querySelector("[data-slot='content']");
        expect(slotContent?.textContent).to.equal("Render 1");

        // Trigger re-render by creating a minimal state change
        const state = { trigger: 0 };
        await inflictBoreDOM(state, {
          "slot-idempotent-component": webComponent(() => {
            let renderCount = 0;
            return ({ slots, self, state }) => {
              renderCount++;
              (slots as any).content = `Render ${renderCount} trigger ${state?.trigger}`;
              self.setAttribute("data-render-count", String(renderCount));
            };
          }),
        });

        // Verify slot was replaced correctly (only one element with data-slot)
        const slotElements = elem.querySelectorAll("[data-slot='content']");
        expect(slotElements.length).to.equal(1);
      });

      it("should handle slot replacement with HTMLElement", async () => {
        const container = await renderHTMLFrame(`
          <slot-element-component></slot-element-component>

          <template data-component="slot-element-component">
            <div><slot name="custom">Placeholder</slot></div>
          </template>
        `);

        await inflictBoreDOM(undefined, {
          "slot-element-component": webComponent(() => {
            return ({ slots }) => {
              const customElem = document.createElement("strong");
              customElem.textContent = "Bold content";
              customElem.classList.add("custom-class");
              (slots as any).custom = customElem;
            };
          }),
        });

        const elem = container.querySelector("slot-element-component") as HTMLElement;
        const strongElem = elem.querySelector("strong.custom-class");
        expect(strongElem).to.not.be.null;
        expect(strongElem?.textContent).to.equal("Bold content");
        expect(strongElem?.getAttribute("data-slot")).to.equal("custom");
      });
    });

    describe("Component detail object", () => {
      it("should pass correct index to each component instance", async () => {
        const container = await renderHTMLFrame(`
          <index-component></index-component>
          <index-component></index-component>
          <index-component></index-component>

          <template data-component="index-component">
            <span></span>
          </template>
        `);

        await inflictBoreDOM(undefined, {
          "index-component": webComponent(({ detail }) => {
            return ({ self }) => {
              self.setAttribute("data-index", String(detail.index));
              self.setAttribute("data-name", detail.name);
            };
          }),
        });

        const components = container.querySelectorAll("index-component");
        expect(components[0].getAttribute("data-index")).to.equal("0");
        expect(components[1].getAttribute("data-index")).to.equal("1");
        expect(components[2].getAttribute("data-index")).to.equal("2");

        // All should have the same tag name
        expect(components[0].getAttribute("data-name")).to.equal("index-component");
      });

      it("should pass custom data through detail when using makeComponent", async () => {
        const container = await renderHTMLFrame(`
          <parent-detail-component></parent-detail-component>

          <template data-component="parent-detail-component">
            <div data-ref="container"></div>
          </template>

          <template data-component="child-detail-component">
            <span></span>
          </template>
        `);

        await inflictBoreDOM(undefined, {
          "parent-detail-component": webComponent(() => {
            return ({ refs, makeComponent }) => {
              const child = makeComponent("child-detail-component", {
                detail: { index: 42, name: "child-detail-component", data: { custom: "value" } },
              });
              (refs.container as HTMLElement).appendChild(child);
            };
          }),
          "child-detail-component": webComponent(({ detail }) => {
            return ({ self }) => {
              self.setAttribute("data-custom", (detail as any).data?.custom ?? "none");
            };
          }),
        });

        const child = container.querySelector("child-detail-component") as HTMLElement;
        expect(child.getAttribute("data-custom")).to.equal("value");
      });
    });

    describe("Edge cases and error handling", () => {
      it("should handle undefined state gracefully in render", async () => {
        const container = await renderHTMLFrame(`
          <undefined-state-component></undefined-state-component>

          <template data-component="undefined-state-component">
            <p data-ref="output">Waiting</p>
          </template>
        `);

        // Initialize without state
        await inflictBoreDOM(undefined, {
          "undefined-state-component": webComponent(() => {
            return ({ state, refs }) => {
              if (!state) {
                (refs.output as HTMLElement).textContent = "No state";
                return;
              }
              (refs.output as HTMLElement).textContent = "Has state";
            };
          }),
        });

        const output = container.querySelector("[data-ref='output']") as HTMLElement;
        expect(output.textContent).to.equal("No state");
      });

      it("should handle errors in event handlers gracefully", async () => {
        const errors: any[] = [];
        const originalError = console.error;
        console.error = (...args: any[]) => {
          errors.push(args);
        };

        const container = await renderHTMLFrame(`
          <error-handler-component></error-handler-component>

          <template data-component="error-handler-component">
            <button onclick="dispatch('throwError')">Throw</button>
            <p data-ref="status">OK</p>
          </template>
        `);

        await inflictBoreDOM(undefined, {
          "error-handler-component": webComponent(({ on }) => {
            on("throwError", () => {
              throw new Error("Test error");
            });
            return ({ refs }) => {
              (refs.status as HTMLElement).textContent = "Rendered";
            };
          }),
        });

        const btn = container.querySelector("button") as HTMLButtonElement;
        fireEvent.click(btn);

        console.error = originalError;

        // Should have logged the error
        const errorLogs = errors.filter(
          (e) => e[0] && typeof e[0] === "string" && e[0].includes("Error"),
        );
        expect(errorLogs.length).to.be.greaterThan(0);

        // Component should still be functional
        const status = container.querySelector("[data-ref='status']") as HTMLElement;
        expect(status.textContent).to.equal("Rendered");
      });

      it("should not re-render when setting same value", async () => {
        const container = await renderHTMLFrame(`
          <same-value-component></same-value-component>

          <template data-component="same-value-component">
            <p>Same value test</p>
          </template>
        `);

        let renderCount = 0;

        // Use the returned proxy for mutations (top-level props need proxy access)
        const state = await inflictBoreDOM({ value: "test" }, {
          "same-value-component": webComponent(() => {
            return ({ self, state }: any) => {
              renderCount++;
              // Must read from state to subscribe to changes
              self.setAttribute("data-value", state.value ?? "none");
              self.setAttribute("data-render-count", String(renderCount));
            };
          }),
        });

        expect(renderCount).to.equal(1);

        // Set same value - should NOT trigger re-render
        state.value = "test";

        await frame();

        // Should NOT have re-rendered (same value)
        expect(renderCount).to.equal(1);

        // Set different value - should trigger re-render
        state.value = "different";

        await frame();

        // Should have re-rendered
        expect(renderCount).to.equal(2);
      });
    });
  });

  describe("Utility functions", () => {
    describe("flatten()", () => {
      it("should flatten a simple object into path-value pairs", () => {
        const obj = { a: 1, b: 2 };
        const result = flatten(obj);

        expect(result).to.deep.include({ path: ["a"], value: 1 });
        expect(result).to.deep.include({ path: ["b"], value: 2 });
      });

      it("should flatten nested objects recursively", () => {
        const obj = { a: { b: { c: 1 } } };
        const result = flatten(obj);

        expect(result).to.deep.include({ path: ["a"], value: { b: { c: 1 } } });
        expect(result).to.deep.include({ path: ["a", "b"], value: { c: 1 } });
        expect(result).to.deep.include({ path: ["a", "b", "c"], value: 1 });
      });

      it("should ignore keys specified in the ignore array", () => {
        const obj = { a: 1, internal: { secret: "hidden" }, b: 2 };
        const result = flatten(obj, ["internal"]);

        expect(result).to.deep.include({ path: ["a"], value: 1 });
        expect(result).to.deep.include({ path: ["b"], value: 2 });

        const internalPaths = result.filter((r) => r.path.includes("internal"));
        expect(internalPaths.length).to.equal(0);
      });

      it("should handle arrays within objects", () => {
        const obj = { items: [1, 2, 3] };
        const result = flatten(obj);

        expect(result).to.deep.include({ path: ["items"], value: [1, 2, 3] });
        expect(result).to.deep.include({ path: ["items", "0"], value: 1 });
        expect(result).to.deep.include({ path: ["items", "1"], value: 2 });
        expect(result).to.deep.include({ path: ["items", "2"], value: 3 });
      });

      it("should handle empty objects", () => {
        const obj = {};
        const result = flatten(obj);

        expect(result).to.deep.equal([]);
      });

      it("should handle objects with null values", () => {
        const obj = { a: null, b: 1 };
        const result = flatten(obj);

        expect(result).to.deep.include({ path: ["a"], value: null });
        expect(result).to.deep.include({ path: ["b"], value: 1 });
      });
    });

    describe("access()", () => {
      it("should access top-level properties", () => {
        const obj = { a: 1, b: 2 };
        expect(access(["a"], obj)).to.equal(1);
        expect(access(["b"], obj)).to.equal(2);
      });

      it("should access nested properties", () => {
        const obj = { foo: { bar: { baz: "deep" } } };
        expect(access(["foo", "bar", "baz"], obj)).to.equal("deep");
        expect(access(["foo", "bar"], obj)).to.deep.equal({ baz: "deep" });
      });

      it("should return undefined for non-existent paths", () => {
        const obj = { a: 1 };
        expect(access(["b"], obj)).to.be.undefined;
        expect(access(["a", "b"], obj)).to.be.undefined;
      });

      it("should return the object itself for empty path", () => {
        const obj = { a: 1 };
        expect(access([], obj)).to.deep.equal(obj);
      });

      it("should handle array indices in path", () => {
        const obj = { items: ["a", "b", "c"] };
        expect(access(["items", "0"], obj)).to.equal("a");
        expect(access(["items", "2"], obj)).to.equal("c");
      });

      it("should handle null gracefully", () => {
        expect(access(["a"], null as any)).to.be.null;
      });
    });

    describe("isPOJO()", () => {
      it("should return true for plain objects", () => {
        expect(isPOJO({})).to.be.true;
        expect(isPOJO({ a: 1 })).to.be.true;
        expect(isPOJO({ nested: { object: true } })).to.be.true;
      });

      it("should return false for arrays", () => {
        expect(isPOJO([])).to.be.false;
        expect(isPOJO([1, 2, 3])).to.be.false;
      });

      it("should return false for null", () => {
        expect(isPOJO(null)).to.be.false;
      });

      it("should return false for undefined", () => {
        expect(isPOJO(undefined)).to.be.false;
      });

      it("should return false for primitives", () => {
        expect(isPOJO(42)).to.be.false;
        expect(isPOJO("string")).to.be.false;
        expect(isPOJO(true)).to.be.false;
        expect(isPOJO(Symbol("test"))).to.be.false;
      });

      it("should return false for class instances", () => {
        class MyClass {
          value = 1;
        }
        expect(isPOJO(new MyClass())).to.be.false;
      });

      it("should return false for built-in objects", () => {
        expect(isPOJO(new Date())).to.be.false;
        expect(isPOJO(new Map())).to.be.false;
        expect(isPOJO(new Set())).to.be.false;
        expect(isPOJO(/regex/)).to.be.false;
      });

      it("should return false for functions", () => {
        expect(isPOJO(() => {})).to.be.false;
        expect(isPOJO(function () {})).to.be.false;
      });

      it("should return true for Object.create(null)", () => {
        const nullProto = Object.create(null);
        nullProto.a = 1;
        // Object.create(null) has no prototype, but isPOJO treats it as a POJO
        // since it's still a plain object (just without Object.prototype)
        expect(isPOJO(nullProto)).to.be.true;
      });
    });
  });
}
