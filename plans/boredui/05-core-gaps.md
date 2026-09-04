# What boreDOM needs

Building the kit against boreDOM as it stands surfaces five gaps. One of them blocks the
whole approach and should be decided before milestone 1. The other four have workarounds
that live in the kit, and each is a judgement call about whether the core should absorb
it.

## 1. Author children have nowhere to go. Blocking.

`hydrate()` in `src/element.ts` appends the cloned template to the host:

```js
host.appendChild(template.content.cloneNode(true));
```

So `<ui-button>Save</ui-button>` becomes the text `Save` followed by the template's
`<button>`, with the label outside the button that is supposed to contain it. Every wrapper
component in the kit has this problem, which is most of them.

The fix is about ten lines in `hydrate()`: capture the host's existing children before the
append, and afterwards move them into the element marked `data-slot`.

```js
function hydrate(host, name) {
  const template = templateFor(name);
  if (!template) return;
  // ... existing attribute mirroring ...
  const children = host.firstChild ? [...host.childNodes] : null;
  host.appendChild(template.content.cloneNode(true));
  if (!children) return;
  const slot = host.querySelector("[data-slot]");
  if (slot) slot.append(...children);
}
```

Named slots are a small extension: a child carrying `slot="icon"` goes to
`[data-slot="icon"]`, everything else to the unnamed `[data-slot]`. Version one can ship
with the unnamed slot alone and add names when a component needs them, which is the icon
button and the field.

Two things to check when implementing it. `refsOf()` scopes a ref to the nearest component
host, so a `data-ref` inside author-provided content now belongs to the wrapper rather than
to the page, which is the right answer but should be documented. And a component with no
`[data-slot]` keeps today's behaviour exactly, so nothing existing changes.

The alternative, if this change is unwanted, is for kit components to build their DOM in
`init` where they can read `self.childNodes` before touching them. That works today with
no core change and costs the thing boreDOM exists for, which is markup you can read in
view source. Take the ten lines.

## 2. `define()` throws on a second call

```js
if (definitions.has(name)) throw new Error(`define("${name}") was already called`);
```

A page that imports two kit modules which both pull in `ui-button` gets an exception, and
so does an application that wants to replace a kit component with its own. The kit can
guard by catching, which is ugly, or by tracking its own registry, which duplicates state.

Export a query instead:

```js
export function defined(name) { return definitions.has(name); }
```

Four lines, no behaviour change, and the kit's `install()` becomes honest. The throw stays,
because two accidental definitions of the same name is still a bug.

## 3. A missing ref throws, with no way to ask

`refsOf()` returns a proxy with only a `get` trap, so `"icon" in refs` is always false and
`refs.icon` throws when the element is absent. Kit components have optional parts: a button
may or may not have an icon, a field may or may not have a description.

Add a `has` trap that resolves the same way `get` does and returns a boolean instead of
throwing. Then `if ("icon" in refs)` reads naturally and the throw on `get` keeps
protecting the common case, which is a typo.

```js
has(_, name) {
  if (typeof name !== "string") return false;
  const known = found.get(name);
  if (known && host.contains(known)) return true;
  for (const el of host.querySelectorAll(`[data-ref="${CSS.escape(name)}"]`)) {
    if (hostOf(el.parentNode) === host) { found.set(name, el); return true; }
  }
  return false;
}
```

## 4. Attributes are not reactive

There is no `attributeChangedCallback`, so a component cannot re-render when someone writes
`el.setAttribute("disabled", "")` from outside. Application code does this constantly,
usually from a framework-free script or from devtools.

Keep this out of the core for now and solve it in the kit with a helper:

```js
// mirrors the named attributes into local, so renders track them
export function observeAttributes(self, local, names) {
  for (const name of names) local[name] = self.getAttribute(name);
  const observer = new MutationObserver((records) => {
    for (const r of records) local[r.attributeName] = self.getAttribute(r.attributeName);
  });
  observer.observe(self, { attributes: true, attributeFilter: names });
  return () => observer.disconnect();
}
```

One observer per component that opts in, disconnected in `onCleanup`. If every kit
component ends up calling it, promote it to the core as a declarative
`data-observe="disabled selected"` on the template, which fits boreDOM's style better than
an imperative call. Decide after the tier 1 components are written, with evidence.

## 5. Properties set from outside are not tracked

`self.todo` in the todo example works because `todo` is already a reactive object taken
from `state`. A kit component receiving a plain value, `el.items = [...]`, gets no render.

Solve it in the kit with an accessor helper rather than in the core:

```js
// defines get/set pairs on the element that read and write local
export function props(self, local, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    local[key] = self[key] ?? value;
    Object.defineProperty(self, key, {
      get: () => local[key],
      set: (v) => { local[key] = v; },
      enumerable: true, configurable: true,
    });
  }
}
```

This is a kit concern because it is a component authoring convention, not a framework
primitive, and boreDOM is right to stay out of it.

## Not gaps

Worth writing down so they do not get reopened.

The action bus covers the events a component author dispatches from markup. Behaviors use
direct listeners for `pointermove`, `pointercancel`, `wheel` and `contextmenu`, which are
either high frequency or not worth delegating, and that is the correct split rather than a
missing feature.

Array reactivity is coarse: reading any part of an array subscribes to the whole array. For
a list rendered with `keyed()` this is exactly right, since the render pass walks the whole
list anyway. Do not ask for fine grained array tracking on the kit's behalf.

`mount()` runs once per page and there is one application state. The kit never touches
`state`, only `local` and the DOM, so it composes with any application shape.
