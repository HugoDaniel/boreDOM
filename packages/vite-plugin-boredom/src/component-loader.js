/**
 * Component Loader for development runtime
 * Dynamically loads boreDOM component modules during development
 */

const loadedComponents = new Map();
const componentDependencies = new Map();
const componentPaths = new Map(); // Registry for component name -> module mapping

function queuePendingComponent(name) {
  window.__pendingComponents = window.__pendingComponents || [];
  if (!window.__pendingComponents.includes(name)) {
    window.__pendingComponents.push(name);
  }
}

/**
 * Register a component path mapping
 * @param {string} name - Component name (e.g., 'ui-button')
 * @param {Promise<any>} modulePromise - Dynamic import promise
 */
export function registerComponentPath(name, modulePromise) {
  componentPaths.set(name, modulePromise);
}

/**
 * Load a component module and all its dependencies
 * @param {object} componentModule - The component module with metadata, style, template, logic
 */
export async function loadComponent(componentModule) {
  const { metadata, style, template, logic } = componentModule;

  if (!metadata || !metadata.name) {
    console.error('[boredom] Component missing metadata.name:', componentModule);
    return;
  }

  const { name, dependencies = [] } = metadata;

  // Prevent duplicate loading
  if (loadedComponents.has(name)) return;

  // Load dependencies first
  for (const depName of dependencies) {
    if (!loadedComponents.has(depName)) {
      // Check if we have a registered path for this dependency
      const depModulePromise = componentPaths.get(depName);
      if (depModulePromise) {
        try {
          const depModule = await depModulePromise;
          await loadComponent(depModule.default || depModule);
        } catch (error) {
          console.warn(`[boredom] Failed to load dependency ${depName}:`, error);
        }
      } else {
        console.warn(`[boredom] Dependency "${depName}" not registered. Use registerComponentPath() to register it.`);
      }
    }
  }

  // Inject style with dependency ordering
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-component', name);
  styleEl.textContent = style;
  document.head.appendChild(styleEl);

  // Create and register template
  const templateEl = document.createElement('template');
  templateEl.setAttribute('data-component', name);
  templateEl.innerHTML = template;
  document.body.appendChild(templateEl);

  // Register component logic using boreDOM's mechanism
  const logicSource = typeof logic === 'function' ? logic.toString() : logic;
  const logicBlob = new Blob([`export default ${logicSource}`], {
    type: 'text/javascript'
  });
  const logicUrl = URL.createObjectURL(logicBlob);

  // Use boreDOM's existing script loading mechanism
  if (!window.loadedScripts) window.loadedScripts = {};
  window.loadedScripts[name] = import(logicUrl).then(m => {
    URL.revokeObjectURL(logicUrl);
    return m;
  });

  // Define custom element if not exists
  if (!customElements.get(name)) {
    // Wait for ReactiveComponent to be available (boreDOM must be loaded)
    if (window.ReactiveComponent) {
      customElements.define(name, class extends window.ReactiveComponent { });
    } else {
      // Queue registration for when boreDOM loads
      queuePendingComponent(name);
    }
  }

  loadedComponents.set(name, componentModule);
  componentDependencies.set(name, dependencies);
}

/**
 * Get all loaded components
 * @returns {Array} Array of [name, module] pairs
 */
export function getLoadedComponents() {
  return Array.from(loadedComponents.entries());
}

/**
 * Get the dependency graph
 * @returns {Array} Array of [name, dependencies] pairs
 */
export function getDependencyGraph() {
  return Array.from(componentDependencies.entries());
}

/**
 * Check if a component is loaded
 * @param {string} name - Component name
 * @returns {boolean}
 */
export function isComponentLoaded(name) {
  return loadedComponents.has(name);
}

/**
 * Hot reload a component (for HMR support)
 * @param {string} name - Component name
 * @param {object} newModule - New component module
 */
export async function reloadComponent(name, newModule) {
  if (!loadedComponents.has(name)) {
    return loadComponent(newModule);
  }

  // Remove existing style
  document.querySelectorAll(`style[data-component="${name}"]`).forEach(el => el.remove());

  // Remove existing template
  document.querySelectorAll(`template[data-component="${name}"]`).forEach(el => el.remove());

  // Clear from caches
  loadedComponents.delete(name);
  if (window.loadedScripts) {
    delete window.loadedScripts[name];
  }

  // Reload
  return loadComponent(newModule);
}

/**
 * Clear all loaded components (useful for testing)
 */
export function clearAllComponents() {
  loadedComponents.forEach((_, name) => {
    document.querySelectorAll(`style[data-component="${name}"]`).forEach(el => el.remove());
    document.querySelectorAll(`template[data-component="${name}"]`).forEach(el => el.remove());
  });
  loadedComponents.clear();
  componentDependencies.clear();
  componentPaths.clear();
}
