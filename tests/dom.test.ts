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
import { inflictBoreDOM } from "../src/index";

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
        const proxifiedState = await inflictBoreDOM(state); // Runs the code in `stateful-component6.js`

        // Update the state:
        console.log("Got proxified state:", proxifiedState);
        state.content.value = "This is new content";

        await frame();

        const elem = getByText(
          container,
          "This is new content",
        );
        expect(elem).to.be.an.instanceof(HTMLSpanElement);
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
        await inflictBoreDOM({ content: { items: ["item A", "item B", "item C"] } });
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
  });
}
