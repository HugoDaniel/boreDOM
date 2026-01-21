/**
 * @file boreDOM.js
 * @description A minimalist, reactivity-driven JavaScript framework optimized for LLM readability and generation.
 * @version 2.0.0
 */

// --- 1. CONSTANTS & CONFIGURATION ---

const CONSTANTS = {
  Attributes: {
    COMPONENT: 'data-component',
    STATE: 'data-state',
    LIST: 'data-list',
    ITEM_TEMPLATE: 'data-item',
    TEXT: 'data-text',
    SHOW: 'data-show',
    VALUE: 'data-value',
    CHECKED: 'data-checked',
    CLASS: 'data-class',
    REF: 'data-ref',
    DISPATCH: 'data-dispatch',
    INPUT: 'data-input',
    CHANGE: 'data-change',
    PROP_PREFIX: 'data-prop-',
  },
  // Supported events - names will be dynamically mapped to data-dispatch attributes
  Events: [
    'click',
    'input',
    'change',
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointerout',
    'keydown',
    'keyup',
    'focus',
    'blur',
  ],
};

// Global Registries
/** @type {Set<ShadowRoot>} */
const activeShadowRoots = new Set();

/** @type {Record<string, Function>} */
const eventHandlers = {};

/** @type {Map<string, CSSStyleSheet[]>} */
const componentStyles = new Map();

/** @type {Record<string, Promise<any>>} */
const loadedScripts = {};

// --- 2. REACTIVITY SYSTEM ---

/**
 * Creates a reactive proxy for state management.
 * @template T
 * @param {T} target - The state object to observe.
 * @param {Function} callback - The function to call on mutation.
 * @returns {T} - The reactive proxy.
 */
const createReactiveState = (target, callback) => {
  if (typeof target !== 'object' || target === null) return target;

  return new Proxy(target, {
    set(obj, prop, value) {
      obj[prop] = value;
      callback();
      return true;
    },
    get(obj, prop) {
      // Lazy recursion for deep reactivity
      return createReactiveState(obj[prop], callback);
    },
    deleteProperty(obj, prop) {
      delete obj[prop];
      callback();
      return true;
    },
  });
};

/**
 * Triggers a DOM update across all active components.
 */
const scheduleGlobalUpdate = () => {
  activeShadowRoots.forEach((root) => {
    // @ts-ignore - 'host' property exists on ShadowRoot
    root.host._update();
  });
};

// --- 3. EXPRESSION EVALUATION ---

/**
 * Evaluates a string expression within a specific scope.
 * @param {string} expr - The JavaScript expression to evaluate.
 * @param {Object} scope - The variables available to the expression.
 * @returns {any} - The result of the evaluation.
 */
const evaluate = (expr, scope) => {
  try {
    const keys = Object.keys(scope);
    const values = Object.values(scope);
    // Function constructor allows evaluation without 'eval()' and strict scoping
    return new Function(...keys, `return ${expr}`)(...values);
  } catch (e) {
    // Fail silently to prevent UI crashes during intermediate states
    return undefined;
  }
};

// --- 4. DOM DIRECTIVES & BINDINGS ---

/**
 * Directives map dataset keys (camelCase of data-attributes) to DOM manipulations.
 * Receives: element, raw expression string, and current context.
 */
const Directives = {
  text: (el, raw, ctx) => {
    const val = evaluate(raw, ctx);
    el.textContent = val !== undefined && val !== null ? val : '';
  },
  show: (el, raw, ctx) => {
    el.style.display = evaluate(raw, ctx) ? '' : 'none';
  },
  value: (el, raw, ctx) => {
    if ('value' in el) el.value = evaluate(raw, ctx) || '';
  },
  checked: (el, raw, ctx) => {
    if ('checked' in el) el.checked = !!evaluate(raw, ctx);
  },
  class: (el, raw, ctx) => {
    // Format: "className:condition"
    const parts = raw.split(':');
    if (parts.length === 2) {
      const [cls, conditionExpr] = parts;
      el.classList.toggle(cls, !!evaluate(conditionExpr, ctx));
    }
  },
  ref: (el, raw, ctx) => {
    // data-ref="myInput" -> ctx.refs.myInput = el
    if (ctx.refs) {
      ctx.refs[raw] = el;
    }
  }
};

/**
 * Determines if an element is owned by the current ShadowRoot or a nested list.
 * @param {Element} el
 * @param {ShadowRoot} root
 * @returns {boolean}
 */
const isElementInScope = (el, root) => {
  let cur = el.parentElement;
  while (cur && cur !== root) {
    if (cur.dataset && cur.dataset.list) return false;
    cur = cur.parentElement;
  }
  return true;
};

/**
 * Processes 'data-list' attributes for rendering lists.
 * @param {ShadowRoot|Element} root
 * @param {Object} context
 */
const processListBindings = (root, context) => {
  const lists = root.querySelectorAll(`[${CONSTANTS.Attributes.LIST}]`);
  
  lists.forEach((listEl) => {
    if (!isElementInScope(listEl, root)) return;

    const itemsExpr = listEl.getAttribute(CONSTANTS.Attributes.LIST);
    const items = evaluate(itemsExpr, context) || [];
    const template = listEl.querySelector(`template[${CONSTANTS.Attributes.ITEM_TEMPLATE}]`);

    if (!template) return;

    // Clean non-template children (naive re-render)
    Array.from(listEl.children).forEach((child) => {
      if (child !== template) child.remove();
    });

    items.forEach((item, index) => {
      // @ts-ignore
      const clone = template.content.cloneNode(true);
      // Create child context
      processBindings(clone, { ...context, item, index });
      listEl.appendChild(clone);
    });
  });
};

/**
 * Applies all Directives to elements within the root using generic loop.
 * @param {ShadowRoot|Element} root
 * @param {Object} context
 */
const processAttributeBindings = (root, context) => {
  const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];

  elements.forEach((el) => {
    if (!isElementInScope(el, root)) return;

    Object.keys(el.dataset).forEach((key) => {
      const rawValue = el.dataset[key];

      // 1. Standard Directives (data-text, data-show, etc.)
      if (Directives[key]) {
        Directives[key](el, rawValue, context);
      }
      
      // 2. Dynamic Props (data-prop-*)
      // Maps data-prop-user-id (dataset.propUserId) -> dataset.userId
      else if (key.startsWith('prop') && key.length > 4) {
        // 'propUserId' -> 'UserId' -> 'userId'
        const propName = key.slice(4)[0].toLowerCase() + key.slice(5);
        const val = evaluate(rawValue, context);
        if (val !== undefined) {
          el.dataset[propName] = val;
        }
      }
    });
  });
};

/**
 * Binding Strategies Registry.
 * Defines the order and type of bindings to apply.
 */
const BindingStrategies = [
  processListBindings,      // Structural bindings first (modifies DOM tree)
  processAttributeBindings, // Attribute bindings second (modifies properties)
];

const processBindings = (root, context) => {
  BindingStrategies.forEach(strategy => strategy(root, context));
};

// --- 5. COMPONENT SYSTEM ---

/**
 * The base class for all boreDOM components.
 * Encapsulates Shadow DOM creation, style application, and event delegation.
 */
class ReactiveComponent extends HTMLElement {
  constructor(templateContent, styles) {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(templateContent.cloneNode(true));
    this.shadowRoot.adoptedStyleSheets = styles;
    
    // Instance-level state and refs
    this.localState = createReactiveState({}, () => this._update());
    this.refs = {};

    // Initialize Slots Proxy
    this.slots = new Proxy({}, {
      set: (target, prop, value) => {
        target[prop] = value;
        this._update();
        return true;
      },
    });

    this._setupPropMirroring();
    this._overrideQuerySelector();
  }

  /**
   * Internal update method.
   * Merges global state, local state, and props (detail/slots) into the context.
   */
  _update() {
    const context = {
      state: globalState,
      local: this.localState,
      detail: this.slots,
      refs: this.refs,
    };

    processBindings(this.shadowRoot, context);

    if (this.renderEffect) {
      this.renderEffect(context);
    }
  }

  /**
   * Mirrors data-prop-* attributes to standard data-* attributes
   * for easier CSS targeting.
   */
  _setupPropMirroring() {
    for (const attr of this.attributes) {
      if (attr.name.startsWith(CONSTANTS.Attributes.PROP_PREFIX)) {
        const newName = attr.name.replace(CONSTANTS.Attributes.PROP_PREFIX, 'data-');
        if (!this.hasAttribute(newName)) {
          this.setAttribute(newName, attr.value);
        }
      }
    }
  }

  /**
   * Convenience method to default querySelector to shadowRoot.
   */
  _overrideQuerySelector() {
    const originalQuerySelector = this.querySelector.bind(this);
    this.querySelector = (selector) => {
      return originalQuerySelector(selector) || this.shadowRoot.querySelector(selector);
    };
  }

  async connectedCallback() {
    activeShadowRoots.add(this.shadowRoot);
    this._setupEventDelegation();
    await this._loadScriptLogic();
    // Initial render
    this._update();
  }

  disconnectedCallback() {
    activeShadowRoots.delete(this.shadowRoot);
  }

  _setupEventDelegation() {
    const handleEvent = (e, actionType) => {
      // Find the closest element with the dispatch attribute
      const dispatcher = e.composedPath().find((el) => el.dataset && el.dataset[actionType]);

      if (dispatcher) {
        const actionName = dispatcher.dataset[actionType];
        if (eventHandlers[actionName]) {
          // Proxy the dispatcher to merge component dataset with element dataset
          const proxyDispatcher = new Proxy(dispatcher, {
            get: (target, prop) => {
              if (prop === 'dataset') return { ...dispatcher.dataset, ...this.dataset };
              const val = target[prop];
              return typeof val === 'function' ? val.bind(target) : val;
            },
          });

          // Inject local state and refs into event handler context
          eventHandlers[actionName]({
            state: globalState,
            local: this.localState,
            refs: this.refs,
            detail: this.slots,
            e: { event: e, dispatcher: proxyDispatcher },
          });
          e.stopPropagation();
        }
      }
    };

    // Register all supported event listeners with dynamic attribute mapping
    CONSTANTS.Events.forEach((event) => {
      // Rule: click -> dispatch, others -> dispatchName
      const actionType = event === 'click' 
        ? 'dispatch' 
        : `dispatch${event[0].toUpperCase()}${event.slice(1)}`;

      const useCapture = ['focus', 'blur'].includes(event);
      this.shadowRoot.addEventListener(event, (e) => handleEvent(e, actionType), { capture: useCapture });
    });
  }

  async _loadScriptLogic() {
    const componentName = this.tagName.toLowerCase();
    if (loadedScripts[componentName]) {
      try {
        const module = await loadedScripts[componentName];
        if (module && module.default) {
          const initFn = module.default;
          // Inject 'on', 'self', and context into initialization
          const renderFn = initFn({
            on: (name, fn) => { eventHandlers[name] = fn; },
            self: this.shadowRoot,
            state: globalState,
            local: this.localState,
            refs: this.refs,
          });

          if (typeof renderFn === 'function') {
            this.renderEffect = renderFn;
          }
        }
      } catch (err) {
        console.error(`[boreDOM] Error executing script for ${componentName}:`, err);
      }
    }
  }
}

// --- 6. INITIALIZATION ---

/**
 * Resource Processors handle different component definition tags.
 */
const ResourceProcessors = {
  STYLE: (node, name) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(node.textContent);
    if (!componentStyles.has(name)) componentStyles.set(name, []);
    componentStyles.get(name).push(sheet);
    node.remove();
  },
  SCRIPT: (node, name) => {
    const blob = new Blob([node.textContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    loadedScripts[name] = import(url).then(m => {
      URL.revokeObjectURL(url);
      return m;
    });
    node.remove();
  },
  TEMPLATE: (node, name) => {
    // @ts-ignore
    const templateContent = node.content;
    if (!customElements.get(name)) {
      customElements.define(name, class extends ReactiveComponent {
        constructor() {
          super(templateContent, componentStyles.get(name) || []);
        }
      });
    }
  }
};

const init = () => {
  // 1. Initialize Global State
  const currentScript = document.currentScript;
  // @ts-ignore
  const stateSelector = currentScript.dataset.state;
  const stateElement = document.querySelector(stateSelector);
  const initialState = stateElement ? JSON.parse(stateElement.textContent) : {};
  
  // Export globalState to window for debugging if needed, but keep const for internal use
  window.globalState = createReactiveState(initialState, scheduleGlobalUpdate);
  // @ts-ignore
  globalState = window.globalState; 

  // 2. Discover and Register Components
  const componentNodes = [
    ...document.querySelectorAll('style[data-component]'),
    ...document.querySelectorAll('script[data-component]'),
    ...document.querySelectorAll('template[data-component]'),
  ];

  componentNodes.forEach((node) => {
    // @ts-ignore
    const name = node.dataset.component;
    const tagName = node.tagName;

    if (ResourceProcessors[tagName]) {
      ResourceProcessors[tagName](node, name);
    }
  });
};

// Variable declaration for internal usage
var globalState;

// Boot
init();