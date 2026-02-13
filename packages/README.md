# Experimental Multi-File boreDOM Workflow

This directory contains boreDOM's experimental multi-file authoring tooling.

boreDOM's primary and recommended path remains single-file, zero-build development in `index.html`. Use this workflow only when you intentionally need multi-file authoring during development and still want single-file deployment output.

## Positioning

- Stable default: single-file boreDOM apps
- Experimental opt-in: Vite + component modules + build back to single HTML
- Production target stays the same: deploy a self-contained HTML file

## Package Structure

```
packages/
├── vite-plugin-boredom/          # Vite plugin that emits single-file boreDOM output
│   ├── src/index.ts              # Build-time transforms
│   └── src/component-loader.js   # Dev-time component loader
└── examples/
    └── multi-file/               # Example project
```

## Quick Start

### Single-file default (recommended)

```bash
npx @mr_hugo/boredom init my-app
cd my-app
open index.html
```

### Experimental multi-file scaffold

```bash
npx @mr_hugo/boredom init my-app --experimental-multi
cd my-app
npm install
npm run dev
```

## Add to Existing Vite Project

```bash
npm install -D @mr_hugo/vite-plugin-boredom@next vite
```

`vite.config.js`:

```js
import { defineConfig } from "vite";
import { boredomPlugin } from "@mr_hugo/vite-plugin-boredom";

export default defineConfig({
  plugins: [boredomPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true
      }
    },
    cssCodeSplit: false
  }
});
```

## Component Module Format

```js
// components/ui/Button.js
export const metadata = {
  name: "ui-button",
  dependencies: [],
  props: ["variant", "label"],
  events: ["click"]
};

export const style = `
  @layer components.ui-button {
    ui-button button { /* styles */ }
  }
`;

export const template = `
  <button data-dispatch="click" data-text="local.label"></button>
`;

export const logic = ({ on, local }) => {
  local.label = local.label || "Button";
  on("click", ({ e }) => {
    // handle click
  });
};
```

## Loading Components in Dev

```js
// main.js
import { loadComponent, registerComponentPath } from "@mr_hugo/vite-plugin-boredom/component-loader";
import * as Button from "./components/ui/Button.js";

async function initApp() {
  registerComponentPath("ui-button", Promise.resolve(Button));
  await loadComponent(Button);
}

initApp();
```

## Generate Component Template

```bash
npx @mr_hugo/boredom component my-widget --experimental-multi
```

Generates `components/ui/MyWidget.js`.

## Build and Deploy

```bash
npm run build
```

Build output is single-file HTML with inlined boreDOM triplets and runtime.

## Migration

### From single-file to experimental multi-file

1. Extract component triplets into module exports (`metadata`, `style`, `template`, `logic`).
2. Add `main.js` that imports modules and calls `loadComponent`.
3. Add Vite config with `boredomPlugin()`.
4. Keep production deployment as generated single HTML output.

### From experimental multi-file back to single-file

1. Run `npm run build`.
2. Deploy the generated HTML file only.
3. Optionally collapse module output back into direct `<style>/<template>/<script type="text/boredom">` triplets.

## Troubleshooting

- Component not loading:
  Verify module exports and `metadata.name`.
- Dependency warnings:
  Register module promises with `registerComponentPath`.
- Build output issues:
  Check Vite config and run `npx @mr_hugo/boredom validate` on the generated HTML.

## Stability Notice

This workflow is experimental and may change. If you need the most stable boreDOM experience, use single-file mode.
