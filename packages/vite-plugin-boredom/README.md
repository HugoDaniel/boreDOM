# @mr_hugo/vite-plugin-boredom

Vite plugin for multi-file boreDOM development with single-file deployment.

## Installation

```bash
npm install -D @mr_hugo/vite-plugin-boredom
```

## Usage

### Vite Configuration

```js
// vite.config.js
import { defineConfig } from 'vite';
import { boredomPlugin } from '@mr_hugo/vite-plugin-boredom';

export default defineConfig({
  plugins: [
    boredomPlugin({
      inlineRuntime: true,
      validateComponents: true,
      optimizeStyles: true,
      // Optional: override which files are scanned for components
      componentInclude: [/\.component\.js$/],
      componentExclude: ['/legacy/']
    })
  ],
  
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        dashboard: 'pages/dashboard.html'
      },
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true
      }
    },
    cssCodeSplit: false
  }
});
```

### Component Structure

Create components as ES modules:

```js
// components/ui/Button.js
export const metadata = {
  name: 'ui-button',
  version: '1.0.0',
  dependencies: [],
  props: ['variant', 'size', 'disabled'],
  events: ['click']
};

export const style = `
  @layer components.ui-button {
    ui-button button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    ui-button[variant="primary"] button {
      background: #007bff;
      color: white;
    }
  }
`;

export const template = `
  <button 
    data-dispatch="click"
    data-class="disabled:local.disabled"
    data-text="local.label || 'Button'"
  ></button>
`;

export const logic = ({ on, local }) => {
  local.variant = local.variant || 'default';
  local.disabled = local.disabled || false;
  local.label = local.label || 'Button';

  on('click', ({ e, local }) => {
    if (local.disabled) return;
    e.dispatcher.dispatchEvent(new CustomEvent('ui-button:click', {
      bubbles: true,
      detail: { variant: local.variant }
    }));
  });
};
```

### Development Setup

```js
// main.js
import { loadComponent } from '@mr_hugo/vite-plugin-boredom/component-loader';

async function initApp() {
  const { Button } = await import('./components/ui/Button.js');
  await loadComponent(Button);
}

initApp();
```

### HTML Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>My App</title>
</head>
<body>
  <script id="initial-state" type="application/json">
    { "user": { "name": "John" } }
  </script>

  <ui-button></ui-button>

  <script type="module" src="./main.js"></script>
  <script src="./boreDOM.js" data-state="#initial-state"></script>
</body>
</html>
```

## Plugin Options

- `inlineRuntime` (boolean, default: true) - Inline boreDOM runtime into HTML
- `validateComponents` (boolean, default: true) - Validate component exports and metadata (emits Vite warnings)
- `optimizeStyles` (boolean, default: true) - Optimize CSS output
- `componentInclude` (`string | RegExp | (id) => boolean` or array, default: all `.js/.mjs/.cjs`) - Select files the plugin should inspect for components
- `componentExclude` (`string | RegExp | (id) => boolean` or array, default: `node_modules`) - Exclude files from component inspection

## Build Output

The plugin transforms your multi-file development setup into a single HTML file:

```html
<!DOCTYPE html>
<html>
<body>
  <ui-button></ui-button>
  
  <!-- Auto-generated component triplets -->
  <style data-component="ui-button">...</style>
  <template data-component="ui-button">...</template>
  <script type="text/boredom" data-component="ui-button">...</script>
  
  <script data-state="#initial-state">
    /* inlined boreDOM runtime */
  </script>
</body>
</html>
```

## Development vs Production

- **Development**: Multi-file with HMR, component reloading
- **Production**: Single HTML file, fully self-contained
- **Deployment**: Zero dependencies, works anywhere

## Component Dependencies

Components can depend on other components:

```js
export const metadata = {
  name: 'ui-modal',
  dependencies: ['ui-button', 'ui-overlay']
};
```

Dependencies are automatically loaded in the correct order.

## License

ISC
