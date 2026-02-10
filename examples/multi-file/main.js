import { loadComponent, registerComponentPath } from '../../packages/vite-plugin-boredom/src/component-loader.js';

// Import all component modules
import * as Button from './components/ui/Button.js';
import * as Modal from './components/ui/Modal.js';
import * as Counter from './components/ui/Counter.js';
import * as LayerTree from './components/ui/LayerTree.js';

const APP_ID = 'multi-file-demo';
const APP_ROOT = '#multi-file-app';

async function initApp() {
  // Register component paths for dependency resolution
  registerComponentPath('ui-button', Promise.resolve(Button), { appId: APP_ID });
  registerComponentPath('ui-modal', Promise.resolve(Modal), { appId: APP_ID });
  registerComponentPath('ui-counter', Promise.resolve(Counter), { appId: APP_ID });
  registerComponentPath('ui-layer-tree', Promise.resolve(LayerTree), { appId: APP_ID });

  // Load components (dependencies are resolved automatically)
  await loadComponent(Button, { appId: APP_ID, root: APP_ROOT });
  await loadComponent(Modal, { appId: APP_ID, root: APP_ROOT });
  await loadComponent(Counter, { appId: APP_ID, root: APP_ROOT });
  await loadComponent(LayerTree, { appId: APP_ID, root: APP_ROOT });

  console.log('Multi-file boreDOM app initialized', { appId: APP_ID });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
