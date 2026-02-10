/**
 * Component Loader for development runtime
 * Dynamically loads boreDOM component modules during development
 */

const DEFAULT_APP_ID = 'default';
const LEGACY_PENDING_SCRIPT_MODULES_KEY = '__BOREDOM_PENDING_SCRIPTS__';

const appStores = new Map();

function getStore(appId) {
  const normalizedAppId = normalizeAppId(appId);
  if (!appStores.has(normalizedAppId)) {
    appStores.set(normalizedAppId, {
      loadedComponents: new Map(),
      componentDependencies: new Map(),
      componentPaths: new Map(),
    });
  }

  return appStores.get(normalizedAppId);
}

function normalizeAppId(appId) {
  if (typeof appId !== 'string') return DEFAULT_APP_ID;
  const trimmed = appId.trim();
  return trimmed || DEFAULT_APP_ID;
}

function normalizeOptions(options) {
  if (!options || typeof options !== 'object') {
    return { appId: DEFAULT_APP_ID, root: document.body };
  }

  const appId = normalizeAppId(options.appId);
  const root = resolveRoot(options.root);
  return { appId, root };
}

function resolveRoot(root) {
  if (!root) return document.body;
  if (root === document || root === document.body || root === document.documentElement) {
    return root;
  }
  if (typeof root === 'string') {
    return document.querySelector(root) || document.body;
  }
  if (root && typeof root === 'object' && root.nodeType) {
    return root;
  }
  return document.body;
}

function queuePendingComponent(name, appId) {
  window.__pendingComponents = window.__pendingComponents || [];
  const entry = appId === DEFAULT_APP_ID
    ? name
    : { name, appId };

  const exists = window.__pendingComponents.some((item) => {
    if (typeof item === 'string') {
      return item === entry;
    }
    if (typeof item === 'object' && item) {
      return item.name === entry.name && item.appId === entry.appId;
    }
    return false;
  });

  if (!exists) {
    window.__pendingComponents.push(entry);
  }
}

function queuePendingScriptModule(name, modulePromise, appId) {
  const normalizedAppId = normalizeAppId(appId);
  if (!window[LEGACY_PENDING_SCRIPT_MODULES_KEY] || typeof window[LEGACY_PENDING_SCRIPT_MODULES_KEY] !== 'object') {
    window[LEGACY_PENDING_SCRIPT_MODULES_KEY] = {};
  }

  const pendingScripts = window[LEGACY_PENDING_SCRIPT_MODULES_KEY];
  if (!pendingScripts[normalizedAppId] || typeof pendingScripts[normalizedAppId] !== 'object') {
    pendingScripts[normalizedAppId] = {};
  }
  pendingScripts[normalizedAppId][name] = modulePromise;

  // Preserve legacy default-app behavior for backward compatibility.
  if (normalizedAppId === DEFAULT_APP_ID) {
    if (!window.loadedScripts) window.loadedScripts = {};
    window.loadedScripts[name] = modulePromise;
  }
}

function registerRuntimeScriptModule(name, modulePromise, appId) {
  if (window.__BOREDOM_RUNTIME && typeof window.__BOREDOM_RUNTIME.registerScriptModule === 'function') {
    window.__BOREDOM_RUNTIME.registerScriptModule(name, modulePromise, { appId });
    return;
  }

  queuePendingScriptModule(name, modulePromise, appId);
}

function ensureComponentDefinition(name, appId) {
  if (customElements.get(name)) return;

  if (window.__BOREDOM_RUNTIME && typeof window.__BOREDOM_RUNTIME.defineReactiveElement === 'function') {
    window.__BOREDOM_RUNTIME.defineReactiveElement(name);
    return;
  }

  if (window.ReactiveComponent) {
    customElements.define(name, class extends window.ReactiveComponent { });
    return;
  }

  queuePendingComponent(name, appId);
}

/**
 * Register a component path mapping
 * @param {string} name - Component name (e.g., 'ui-button')
 * @param {Promise<any>} modulePromise - Dynamic import promise
 * @param {object} options - Optional options ({ appId })
 */
export function registerComponentPath(name, modulePromise, options = {}) {
  const { appId } = normalizeOptions(options);
  const store = getStore(appId);
  store.componentPaths.set(name, modulePromise);
}

/**
 * Load a component module and all its dependencies
 * @param {object} componentModule - The component module with metadata, style, template, logic
 * @param {object} options - Optional options ({ appId, root })
 */
export async function loadComponent(componentModule, options = {}) {
  const { appId, root } = normalizeOptions(options);
  const store = getStore(appId);
  const { metadata, style, template, logic } = componentModule;

  if (!metadata || !metadata.name) {
    console.error('[boredom] Component missing metadata.name:', componentModule);
    return;
  }

  const { name, dependencies = [] } = metadata;

  // Prevent duplicate loading
  if (store.loadedComponents.has(name)) return;

  // Load dependencies first
  for (const depName of dependencies) {
    if (!store.loadedComponents.has(depName)) {
      // Check if we have a registered path for this dependency
      const depModulePromise = store.componentPaths.get(depName);
      if (depModulePromise) {
        try {
          const depModule = await depModulePromise;
          await loadComponent(depModule.default || depModule, { appId, root });
        } catch (error) {
          console.warn(`[boredom] Failed to load dependency ${depName}:`, error);
        }
      } else {
        console.warn(`[boredom] Dependency "${depName}" not registered. Use registerComponentPath() to register it.`);
      }
    }
  }

  // Inject style with app scoping
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-component', name);
  styleEl.setAttribute('data-app', appId);
  styleEl.textContent = style;
  document.head.appendChild(styleEl);

  // Create and register template (prefer app root, fallback to body)
  const templateEl = document.createElement('template');
  templateEl.setAttribute('data-component', name);
  templateEl.setAttribute('data-app', appId);
  templateEl.innerHTML = template;
  (root && typeof root.appendChild === 'function' ? root : document.body).appendChild(templateEl);

  // Register component logic using boreDOM runtime mechanism
  const logicSource = typeof logic === 'function' ? logic.toString() : logic;
  const logicBlob = new Blob([`export default ${logicSource}`], {
    type: 'text/javascript'
  });
  const logicUrl = URL.createObjectURL(logicBlob);
  const modulePromise = import(logicUrl).then(m => {
    URL.revokeObjectURL(logicUrl);
    return m;
  });

  registerRuntimeScriptModule(name, modulePromise, appId);
  ensureComponentDefinition(name, appId);

  store.loadedComponents.set(name, componentModule);
  store.componentDependencies.set(name, dependencies);
}

/**
 * Get all loaded components
 * @param {object} options - Optional options ({ appId })
 * @returns {Array} Array of [name, module] pairs
 */
export function getLoadedComponents(options = {}) {
  const { appId } = normalizeOptions(options);
  return Array.from(getStore(appId).loadedComponents.entries());
}

/**
 * Get the dependency graph
 * @param {object} options - Optional options ({ appId })
 * @returns {Array} Array of [name, dependencies] pairs
 */
export function getDependencyGraph(options = {}) {
  const { appId } = normalizeOptions(options);
  return Array.from(getStore(appId).componentDependencies.entries());
}

/**
 * Check if a component is loaded
 * @param {string} name - Component name
 * @param {object} options - Optional options ({ appId })
 * @returns {boolean}
 */
export function isComponentLoaded(name, options = {}) {
  const { appId } = normalizeOptions(options);
  return getStore(appId).loadedComponents.has(name);
}

/**
 * Hot reload a component (for HMR support)
 * @param {string} name - Component name
 * @param {object} newModule - New component module
 * @param {object} options - Optional options ({ appId, root })
 */
export async function reloadComponent(name, newModule, options = {}) {
  const { appId, root } = normalizeOptions(options);
  const store = getStore(appId);

  if (!store.loadedComponents.has(name)) {
    return loadComponent(newModule, { appId, root });
  }

  // Remove existing style
  document.querySelectorAll(`style[data-component="${name}"][data-app="${appId}"]`).forEach(el => el.remove());

  // Remove existing template
  document.querySelectorAll(`template[data-component="${name}"][data-app="${appId}"]`).forEach(el => el.remove());

  // Clear from caches
  store.loadedComponents.delete(name);
  store.componentDependencies.delete(name);

  // Reload
  return loadComponent(newModule, { appId, root });
}

/**
 * Clear loaded components
 * @param {object} options - Optional options ({ appId })
 */
export function clearAllComponents(options = {}) {
  const normalized = normalizeOptions(options);

  if (!options || typeof options !== 'object' || options.appId === undefined) {
    appStores.forEach((_store, appId) => {
      clearAllComponents({ appId });
    });
    return;
  }

  const { appId } = normalized;
  const store = getStore(appId);

  store.loadedComponents.forEach((_, name) => {
    document.querySelectorAll(`style[data-component="${name}"][data-app="${appId}"]`).forEach(el => el.remove());
    document.querySelectorAll(`template[data-component="${name}"][data-app="${appId}"]`).forEach(el => el.remove());
  });

  store.loadedComponents.clear();
  store.componentDependencies.clear();
  store.componentPaths.clear();
}
