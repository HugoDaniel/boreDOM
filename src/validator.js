const parse5 = require("parse5");
const acorn = require("acorn");

const SUPPORTED_EVENTS = new Set([
  "click",
  "dblclick",
  "input",
  "change",
  "dragstart",
  "dragover",
  "drop",
  "dragend",
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointerout",
  "keydown",
  "keyup",
  "focus",
  "blur",
]);

const EXPRESSION_ATTRS = new Set([
  "data-text",
  "data-show",
  "data-value",
  "data-checked",
  "data-list",
  "data-list-key",
]);

const DOC_QUERY_METHODS = new Set([
  "querySelector",
  "querySelectorAll",
  "getElementById",
  "getElementsByClassName",
  "getElementsByTagName",
]);

const COLLECTION_QUERY_METHODS = new Set([
  "querySelectorAll",
  "getElementsByClassName",
  "getElementsByTagName",
]);

const HTML_MUTATION_PROPS = new Set(["innerHTML", "outerHTML"]);
const HTML_MUTATION_METHODS = new Set(["insertAdjacentHTML"]);
const TIMER_CALLS = new Set([
  "requestAnimationFrame",
  "setInterval",
  "setTimeout",
  "addEventListener",
]);

const SEVERITY_BY_CODE = {
  W001: "error",
  W002: "warning",
  W003: "error",
  W004: "warning",
  W005: "error",
  W006: "warning",
  W007: "error",
  W008: "error",
  W009: "error",
  W010: "warning",
  W011: "error",
  W012: "warning",
  W013: "error",
  W014: "error",
  W015: "warning",
  W016: "warning",
  W017: "warning",
  W018: "warning",
  W019: "error",
  W020: "error",
  W021: "warning",
  W022: "info",
  W023: "warning",
  W024: "info",
  W025: "error",
  W026: "error",
  W027: "error",
  W028: "error",
  W029: "warning",
  J010: "error",
  J001: "warning",
  J002: "warning",
  J003: "warning",
  J004: "warning",
  J005: "warning",
  J006: "warning",
  J007: "info",
  J008: "warning",
  J009: "info",
};

function validateHtml(html) {
  const warnings = [];
  const lineIndex = buildLineIndex(html);
  const document = parse5.parse(html, { sourceCodeLocationInfo: true });

  const components = new Map();
  const boredomScripts = [];
  let foundRuntimeScript = /window\.__BOREDOM__/.test(html);
  let runtimeScriptLoc = null;
  let firstComponentLoc = null;
  let foundExternalFont = false;
  let foundCanvas = false;
  let canvasLoc = null;

  const getComponent = (name) => {
    if (!components.has(name)) {
      components.set(name, {
        name,
        templateCount: 0,
        scriptCount: 0,
        refs: new Map(),
        dispatches: new Map(),
        handlers: new Map(),
        parseFailed: false,
        hasKeydown: false,
        hasKeyup: false,
        keydownLoc: null,
        keydownNeedsGuard: false,
        hasEditableGuard: false,
        editableGuardLoc: null,
        usesItemSelected: false,
        itemSelectedLoc: null,
        selectedAssigned: false,
      });
    }
    return components.get(name);
  };

  const walk = (node, context) => {
    if (!node) return;
    const tagName = node.tagName ? node.tagName.toLowerCase() : null;
    const attrs = tagName ? getAttrMap(node) : new Map();

    if (tagName === "template" && attrs.has("data-component")) {
      const componentName = attrs.get("data-component");
      const comp = getComponent(componentName);
      comp.templateCount += 1;
      if (!firstComponentLoc) {
        firstComponentLoc = getAttrLocation(node, "data-component") || getNodeLocation(node);
      }
      if (comp.templateCount > 1) {
        pushWarning(
          warnings,
          "W019",
          `Multiple templates found for component \"${componentName}\"`,
          getAttrLocation(node, "data-component"),
          "Keep a single <template data-component> per component.",
        );
      }
      if (node.content) {
        walk(node.content, { component: componentName });
      }
      return;
    }

    if (tagName === "script") {
      const src = attrs.get("src") || "";
      if (src && /boredom\.js|boreDOM\.js/i.test(src)) {
        foundRuntimeScript = true;
        if (!runtimeScriptLoc) {
          runtimeScriptLoc = getAttrLocation(node, "src") || getNodeLocation(node);
        }
      }
      const type = attrs.get("type");
      if (type === "text/boredom") {
        const componentName = attrs.get("data-component") || null;
        if (componentName) {
          const comp = getComponent(componentName);
          comp.scriptCount += 1;
          if (!firstComponentLoc) {
            firstComponentLoc = getAttrLocation(node, "data-component") || getNodeLocation(node);
          }
          if (comp.scriptCount > 1) {
            pushWarning(
              warnings,
              "W020",
              `Multiple scripts found for component \"${componentName}\"`,
              getAttrLocation(node, "data-component"),
              "Keep a single <script type=\"text/boredom\" data-component> per component.",
            );
          }
        }

        boredomScripts.push({
          componentName,
          content: getTextContent(node),
          startOffset: getScriptContentStartOffset(node),
        });
      }
    }

    if (tagName) {
      const currentComponent = context.component || null;
      const comp = currentComponent ? getComponent(currentComponent) : null;

      if (tagName === "link") {
        const href = attrs.get("href") || "";
        if (/fonts\.googleapis\.com/i.test(href) || /fonts\.gstatic\.com/i.test(href)) {
          foundExternalFont = true;
          pushWarning(
            warnings,
            "W022",
            "External font dependency detected",
            getAttrLocation(node, "href") || getNodeLocation(node),
            "Prefer local/system fonts for offline-friendly demos.",
          );
        }
      }

      if (tagName === "style") {
        const content = getTextContent(node);
        const lower = content.toLowerCase();
        if (lower.includes("@import") && (lower.includes("fonts.googleapis.com") || lower.includes("fonts.gstatic.com"))) {
          foundExternalFont = true;
          pushWarning(
            warnings,
            "W022",
            "External font dependency detected via @import",
            getNodeLocation(node),
            "Prefer local/system fonts for offline-friendly demos.",
          );
        }
      }

      if (tagName === "canvas") {
        foundCanvas = true;
        if (!canvasLoc) canvasLoc = getNodeLocation(node);
      }

      if (attrs.has("data-ref") && comp) {
        const refName = attrs.get("data-ref");
        if (refName) {
          if (comp.refs.has(refName)) {
            pushWarning(
              warnings,
              "W012",
              `Duplicate data-ref \"${refName}\" in component \"${comp.name}\"`,
              getAttrLocation(node, "data-ref"),
              "Use unique data-ref values within a component.",
            );
          } else {
            comp.refs.set(refName, getAttrLocation(node, "data-ref"));
          }
        }
      }

      if (attrs.has("data-action")) {
        const value = attrs.get("data-action");
        pushWarning(
          warnings,
          "W001",
          `Found data-action=\"${value}\" (boreDOM uses data-dispatch)`,
          getAttrLocation(node, "data-action"),
          "Rename to data-dispatch=\"...\" (click) or data-dispatch-<event> for other events.",
          `data-dispatch=\"${value}\"`,
        );
      }

      if (attrs.has("data-class")) {
        const raw = attrs.get("data-class") || "";
        const parts = raw
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean);
        if (!parts.length) {
          pushWarning(
            warnings,
            "W007",
            `data-class is empty`,
            getAttrLocation(node, "data-class"),
            "Format should be \"className:expression\" or \"className:expr; other:expr\".",
          );
        }
        parts.forEach((pair) => {
          const idx = pair.indexOf(":");
          if (idx === -1) {
            pushWarning(
              warnings,
              "W007",
              `data-class missing \":\" separator: \"${pair}\"`,
              getAttrLocation(node, "data-class"),
              "Format should be \"className:expression\".",
            );
            return;
          }
          const left = pair.slice(0, idx).trim();
          const right = pair.slice(idx + 1).trim();
          if (!left || !right) {
            pushWarning(
              warnings,
              "W007",
              `data-class has empty side: \"${pair}\"`,
              getAttrLocation(node, "data-class"),
              "Format should be \"className:expression\".",
            );
            return;
          }
          const looksLikeExpr =
            /(^|\b)(state|local|item|refs|e)\b/.test(left) ||
            /[\[\]\(\)\.\?=]/.test(left);
          if (looksLikeExpr) {
            pushWarning(
              warnings,
              "W002",
              `data-class looks reversed: \"${pair}\"`,
              getAttrLocation(node, "data-class"),
              "Format should be \"className:expression\". Swap sides if needed.",
              `data-class=\"${right}:${left}\"`,
            );
          }
          if (!isValidExpression(right)) {
            pushWarning(
              warnings,
              "W013",
              `Invalid expression in data-class: \"${right}\"`,
              getAttrLocation(node, "data-class"),
              "Check expression syntax in data-class.",
            );
          }
          if (/[A-Za-z_$][\w$]*\.\d+\b/.test(right)) {
            pushWarning(
              warnings,
              "W005",
              `Expression uses numeric dot access: \"${right}\"`,
              getAttrLocation(node, "data-class"),
              "Use bracket notation for numeric keys (e.g. state.foo['1']).",
            );
          }
          trackItemSelected(comp, right, getAttrLocation(node, "data-class"));
        });
      }

      if (attrs.has("data-show") && attrs.has("style")) {
        const style = attrs.get("style") || "";
        if (/display\s*:/i.test(style)) {
          pushWarning(
            warnings,
            "W017",
            "data-show used with inline display style",
            getAttrLocation(node, "data-show"),
            "Avoid inline display styles when using data-show.",
          );
        }
      }

      if (attrs.has("data-list")) {
        if (context.inList) {
          pushWarning(
            warnings,
            "W026",
            "Nested data-list detected (boreDOM Lite forbids nested lists)",
            getAttrLocation(node, "data-list"),
            "Flatten the list or move the nested list into a child component.",
          );
        }
        const listOnce = attrs.has("data-list-once") || attrs.has("data-list-static");
        if (!attrs.has("data-list-key") && !listOnce) {
          pushWarning(
            warnings,
            "W015",
            "data-list without data-list-key",
            getAttrLocation(node, "data-list"),
            "Add data-list-key for stable list item updates, or add data-list-once for static lists.",
          );
        }

        const templateCount = countTemplateDataItems(node);
        if (templateCount === 0) {
          pushWarning(
            warnings,
            "W003",
            "data-list found without a <template data-item> inside the list element",
            getAttrLocation(node, "data-list") || getNodeLocation(node),
            "Add a <template data-item> inside the list element to render items.",
          );
        }
        if (templateCount > 1) {
          pushWarning(
            warnings,
            "W011",
            "data-list contains multiple <template data-item> blocks",
            getAttrLocation(node, "data-list") || getNodeLocation(node),
            "Use a single <template data-item> per list.",
          );
        }

        const listExpr = attrs.get("data-list");
        if (listExpr && !isValidExpression(listExpr)) {
          pushWarning(
            warnings,
            "W013",
            `Invalid expression in data-list: \"${listExpr}\"`,
            getAttrLocation(node, "data-list"),
            "Check expression syntax in data-list.",
          );
        }
        if (attrs.has("data-list-key")) {
          const keyExpr = attrs.get("data-list-key");
          if (keyExpr) {
            if (!isValidExpression(keyExpr)) {
              pushWarning(
                warnings,
                "W013",
                `Invalid expression in data-list-key: \"${keyExpr}\"`,
                getAttrLocation(node, "data-list-key"),
                "Check expression syntax in data-list-key.",
              );
            }
            if (isUnstableKeyExpression(keyExpr)) {
              pushWarning(
                warnings,
                "W016",
                `data-list-key looks unstable: \"${keyExpr}\"`,
                getAttrLocation(node, "data-list-key"),
                isStaticListExpression(listExpr)
                  ? "If this is a fixed grid, prefer data-list-once/data-list-static over index keys."
                  : "Use stable unique IDs for list keys (e.g. item.id).",
              );
            } else if (isLikelyNonUniqueKeyExpression(keyExpr)) {
              pushWarning(
                warnings,
                "W023",
                `data-list-key may not be unique: \"${keyExpr}\"`,
                getAttrLocation(node, "data-list-key"),
                "Time-based keys can collide; prefer unique ids (e.g. item.id).",
              );
            }
          }
        }
      }

      if (tagName === "input" || tagName === "select" || tagName === "textarea") {
        if (attrs.has("data-value")) {
          const hasDispatch =
            attrs.has("data-dispatch-input") ||
            attrs.has("data-dispatch-change") ||
            attrs.has("data-dispatch");
          if (!hasDispatch) {
            pushWarning(
              warnings,
              "W004",
              `${tagName} has data-value but no data-dispatch-input/change`,
              getAttrLocation(node, "data-value") || getNodeLocation(node),
              "Add data-dispatch-input (inputs) or data-dispatch-change (selects) to keep state in sync.",
            );
          }
        }
      }

      for (const [name, value] of attrs.entries()) {
        if (name.startsWith("data-dispatch-")) {
          const eventName = name.slice("data-dispatch-".length);
          if (!SUPPORTED_EVENTS.has(eventName)) {
            pushWarning(
              warnings,
              "W008",
              `Unsupported event in ${name}`,
              getAttrLocation(node, name),
              `Use one of: ${Array.from(SUPPORTED_EVENTS).join(", ")}.`,
            );
          }

          if (eventName === "keydown") {
            if (comp) {
              comp.hasKeydown = true;
              if (!comp.keydownLoc) comp.keydownLoc = getAttrLocation(node, name);
              const isInputLike = tagName === "input" || tagName === "select" || tagName === "textarea";
              const editable = attrs.has("contenteditable") && attrs.get("contenteditable") !== "false";
              if (!isInputLike && !editable) {
                comp.keydownNeedsGuard = true;
              }
            }
          }
          if (eventName === "keyup" && comp) {
            comp.hasKeyup = true;
          }
          if (eventName === "pointerout") {
            pushWarning(
              warnings,
              "W021",
              "data-dispatch-pointerout can fire when moving between children",
              getAttrLocation(node, name),
              "Prefer pointerup or guard pointerout with relatedTarget checks.",
            );
          }

          if (comp && SUPPORTED_EVENTS.has(eventName)) {
            const actionName = value || "";
            if (actionName) {
              if (!comp.dispatches.has(actionName)) {
                comp.dispatches.set(actionName, getAttrLocation(node, name));
              }
            }
          }

          if ((eventName === "input" || eventName === "change") && tagName) {
            const isInputLike = tagName === "input" || tagName === "select" || tagName === "textarea";
            const editable = attrs.has("contenteditable") && attrs.get("contenteditable") !== "false";
            if (!isInputLike && !editable) {
              pushWarning(
                warnings,
                "W018",
                `${name} used on non-input element`,
                getAttrLocation(node, name),
                "Use data-dispatch-input/change on input, select, textarea, or contenteditable elements.",
              );
            }
          }
        }

        if (name === "data-dispatch" && comp) {
          const actionName = value || "";
          if (actionName && !comp.dispatches.has(actionName)) {
            comp.dispatches.set(actionName, getAttrLocation(node, name));
          }
        }

        if (name.startsWith("data-prop-")) {
          pushWarning(
            warnings,
            "W025",
            `data-prop-* is not supported in boreDOM Lite: ${name}`,
            getAttrLocation(node, name),
            "Use data-arg-* for event arguments or data-attr-* to set attributes.",
          );
        }

        if (name.startsWith("data-arg-") || name.startsWith("data-attr-")) {
          if (!value || !value.trim()) {
            pushWarning(
              warnings,
              "W014",
              `Empty expression for ${name}`,
              getAttrLocation(node, name),
              "Provide a valid expression for data-arg-* or data-attr-*.",
            );
          } else if (!isValidExpression(value)) {
            pushWarning(
              warnings,
              "W013",
              `Invalid expression in ${name}: \"${value}\"`,
              getAttrLocation(node, name),
              "Check expression syntax in data-arg-* or data-attr-*.",
            );
          }
          trackItemSelected(comp, value, getAttrLocation(node, name));
        }

        if ((EXPRESSION_ATTRS.has(name) || name.startsWith("data-arg-") || name.startsWith("data-attr-")) && /[A-Za-z_$][\w$]*\.\d+\b/.test(value)) {
          pushWarning(
            warnings,
            "W005",
            `Expression uses numeric dot access: \"${value}\"`,
            getAttrLocation(node, name) || getNodeLocation(node),
            "Use bracket notation for numeric keys (e.g. state.foo['1']).",
          );
        }

        if (EXPRESSION_ATTRS.has(name)) {
          if (name === "data-list" || name === "data-list-key") continue;
          if (name === "data-class") continue;
          if (value && !isValidExpression(value)) {
            pushWarning(
              warnings,
              "W013",
              `Invalid expression in ${name}: \"${value}\"`,
              getAttrLocation(node, name),
              "Check expression syntax in bindings.",
            );
          }
          trackItemSelected(comp, value, getAttrLocation(node, name));
        }
      }
    }

    const nextContext = attrs.has("data-list")
      ? { ...context, inList: true }
      : context;

    if (node.childNodes) {
      node.childNodes.forEach((child) => walk(child, nextContext));
    }

    if (node.content) {
      walk(node.content, nextContext);
    }
  };

  walk(document, { component: null, inList: false });

  const listOnceNodes = [];
  const collectListOnceNodes = (node) => {
    if (!node) return;
    if (node.tagName) {
      const attrs = getAttrMap(node);
      if (attrs.has("data-list") && (attrs.has("data-list-once") || attrs.has("data-list-static"))) {
        listOnceNodes.push({ node, attrs });
      }
    }
    if (node.childNodes) {
      node.childNodes.forEach((child) => collectListOnceNodes(child));
    }
    if (node.content) {
      collectListOnceNodes(node.content);
    }
  };
  collectListOnceNodes(document);

  listOnceNodes.forEach(({ node, attrs }) => {
    const listExpr = attrs.get("data-list");
    if (!listExpr || isStaticListExpression(listExpr)) return;
    const templateNode = findTemplateDataItem(node);
    const dynamicBinding = templateNode ? findDynamicBindingInTemplate(templateNode) : null;
    if (!dynamicBinding) return;
    pushWarning(
      warnings,
      "W029",
      "data-list-once used on a list with dynamic bindings",
      getAttrLocation(node, "data-list-once") ||
        getAttrLocation(node, "data-list-static") ||
        getAttrLocation(node, "data-list") ||
        dynamicBinding.loc,
      "Remove data-list-once/data-list-static when list items or state are expected to change.",
    );
  });

  const placeholderIndex = html.indexOf("${scriptTag}");
  if (placeholderIndex !== -1) {
    const pos = getLineCol(lineIndex, placeholderIndex);
    pushWarning(
      warnings,
      "W028",
      "Template placeholder ${scriptTag} detected",
      pos ? { startLine: pos.line, startCol: pos.col } : null,
      "Replace with <script src=\"./boreDOM.js\" data-state=\"#initial-state\"></script>.",
    );
  }

  if (!foundRuntimeScript && (components.size > 0 || boredomScripts.length > 0)) {
    pushWarning(
      warnings,
      "W027",
      "boreDOM runtime script not found",
      runtimeScriptLoc || firstComponentLoc || { startLine: 1, startCol: 1 },
      "Add <script src=\"./boreDOM.js\" data-state=\"#initial-state\"></script>.",
    );
  }

  if (
    !foundExternalFont &&
    (/fonts\.googleapis\.com/i.test(html) || /fonts\.gstatic\.com/i.test(html))
  ) {
    const matchIndex = html.search(/fonts\.googleapis\.com|fonts\.gstatic\.com/i);
    const pos = matchIndex >= 0 ? getLineCol(lineIndex, matchIndex) : null;
    pushWarning(
      warnings,
      "W022",
      "External font dependency detected",
      pos ? { startLine: pos.line, startCol: pos.col } : null,
      "Prefer local/system fonts for offline-friendly demos.",
    );
  }

  components.forEach((comp) => {
    if (comp.hasKeydown && !comp.hasKeyup) {
      pushWarning(
        warnings,
        "W006",
        "Found data-dispatch-keydown but no data-dispatch-keyup",
        comp.keydownLoc,
        "If your handler branches on keyup, add data-dispatch-keyup to the same element.",
      );
    }
    if (comp.keydownNeedsGuard && !comp.hasEditableGuard) {
      pushWarning(
        warnings,
        "J008",
        "Keyboard handler lacks editable-target guard",
        comp.keydownLoc,
        "Guard key handlers with event.target/composedPath() or closest('input, textarea, [contenteditable]'). Consider a hidden input key-capture pattern if global shortcuts are needed.",
      );
    }
  });

  boredomScripts.forEach((script) => {
    warnings.push(...validateScript(script, lineIndex, components));
  });

  if (foundCanvas && !warnings.some((warning) => warning.code === "J009")) {
    pushWarning(
      warnings,
      "J009",
      "Canvas usage detected",
      canvasLoc,
      "Consider state echoing for audio/canvas so behavior can be tested/verified.",
    );
  }

  components.forEach((comp) => {
    if (!comp.parseFailed) {
      comp.dispatches.forEach((loc, actionName) => {
        if (!comp.handlers.has(actionName)) {
          pushWarning(
            warnings,
            "W009",
            `No handler found for action \"${actionName}\" in component \"${comp.name}\"`,
            loc,
            `Add on(\"${actionName}\", ...) in the component script. Note: the validator only detects literal on(\"...\") calls.`,
          );
        }
      });

      comp.handlers.forEach((loc, actionName) => {
        if (!comp.dispatches.has(actionName)) {
          pushWarning(
            warnings,
            "W010",
            `Handler \"${actionName}\" is never dispatched in component \"${comp.name}\"`,
            loc,
            `Add data-dispatch=\"${actionName}\" to an element in the template.`,
          );
        }
      });
    }

    if (comp.usesItemSelected && !comp.selectedAssigned) {
      pushWarning(
        warnings,
        "W024",
        `item.selected is used in component \"${comp.name}\" but never assigned`,
        comp.itemSelectedLoc,
        "Either set item.selected in script or bind selection from shared state.",
      );
    }
  });

  return warnings;
}

function validateScript(script, lineIndex, components) {
  const warnings = [];
  const source = script.content || "";
  if (!source.trim()) return warnings;

  const comp = script.componentName ? components.get(script.componentName) : null;

  let ast;
  try {
    ast = acorn.parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    });
  } catch (err) {
    if (comp) {
      comp.parseFailed = true;
    }
    const loc = err && err.loc ? { start: err.loc } : null;
    pushWarning(
      warnings,
      "J010",
      `Script parse error: ${err.message}`,
      loc ? mapScriptLoc(script, lineIndex, loc) : null,
      "Fix syntax errors so handlers can be analyzed.",
    );
    return warnings;
  }

  let hasOnCleanup = false;
  let needsMediaHint = false;
  let mediaHintLoc = null;
  const keyupChecks = [];
  const collectionVars = new Set();
  const onAliases = new Set(["on"]);
  const objectKeyMap = new Map();

  walkAst(ast, (node) => {
    if (node.type === "CallExpression") {
      if (node.callee && node.callee.type === "Identifier" && node.callee.name === "onCleanup") {
        hasOnCleanup = true;
      }
    }
  });

  walkAst(ast, (node, parent) => {
    if (node.type === "VariableDeclarator") {
      if (node.id) {
        if (node.id.type === "Identifier") {
          if (isOnReference(node.init, onAliases)) {
            onAliases.add(node.id.name);
          }
          if (node.init && node.init.type === "ObjectExpression") {
            const keys = getObjectExpressionKeys(node.init);
            if (keys.size) {
              objectKeyMap.set(node.id.name, { keys, loc: mapScriptLoc(script, lineIndex, node.loc) });
            }
          }
        } else if (node.id.type === "ObjectPattern") {
          node.id.properties.forEach((prop) => {
            if (!prop || prop.type !== "Property") return;
            const keyName = getPropertyKeyName(prop.key);
            if (keyName === "on") {
              const value = prop.value;
              if (value && value.type === "Identifier") {
                onAliases.add(value.name);
              } else if (value && value.type === "AssignmentPattern" && value.left.type === "Identifier") {
                onAliases.add(value.left.name);
              }
            }
          });
        }
      }
      if (node.id && node.id.type === "Identifier") {
        if (isCollectionCall(node.init) || isArrayFromCollectionCall(node.init, collectionVars)) {
          collectionVars.add(node.id.name);
        }
      }
    }

    if (node.type === "CallExpression") {
      const onCallName = getOnCallName(node, onAliases);
      if (onCallName && comp && !comp.handlers.has(onCallName)) {
        comp.handlers.set(onCallName, mapScriptLoc(script, lineIndex, node.loc));
      }

      if (node.callee && node.callee.type === "Identifier") {
        if (TIMER_CALLS.has(node.callee.name) && !hasOnCleanup) {
          pushWarning(
            warnings,
            "J003",
            `${node.callee.name} used without onCleanup`,
            mapScriptLoc(script, lineIndex, node.loc),
            "Add onCleanup to cancel timers/listeners created in onMount.",
          );
        }
        if (node.callee.name === "AudioContext" || node.callee.name === "webkitAudioContext") {
          needsMediaHint = true;
          if (!mediaHintLoc) mediaHintLoc = mapScriptLoc(script, lineIndex, node.loc);
        }
      }

      const entry = getObjectEntriesInfo(node, objectKeyMap, onAliases, script, lineIndex);
      if (entry) {
        if (entry && comp) {
          entry.keys.forEach((name) => {
            if (!comp.handlers.has(name)) {
              comp.handlers.set(name, entry.loc);
            }
          });
        }
      }

      if (
        node.callee &&
        node.callee.type === "MemberExpression" &&
        node.callee.property &&
        node.callee.property.type === "Identifier"
      ) {
        if (HTML_MUTATION_METHODS.has(node.callee.property.name)) {
          pushWarning(
            warnings,
            "J002",
            `Imperative HTML mutation via ${node.callee.property.name}`,
            mapScriptLoc(script, lineIndex, node.loc),
            "Prefer data-list/data-text bindings over innerHTML mutations.",
          );
        }
        if (node.callee.property.name === "addEventListener" && !hasOnCleanup) {
          pushWarning(
            warnings,
            "J003",
            "addEventListener used without onCleanup",
            mapScriptLoc(script, lineIndex, node.loc),
            "Add onCleanup to remove event listeners created in onMount.",
          );
        }

        if (node.callee.property.name === "getContext") {
          needsMediaHint = true;
          if (!mediaHintLoc) mediaHintLoc = mapScriptLoc(script, lineIndex, node.loc);
        }

        if (node.callee.property.name === "addEventListener") {
          const target = node.callee.object;
          const eventName = getStringLiteral(node.arguments?.[0]);
          if (
            eventName &&
            (eventName === "keydown" || eventName === "keyup") &&
            target &&
            target.type === "Identifier" &&
            (target.name === "window" || target.name === "document")
          ) {
            pushWarning(
              warnings,
              "J006",
              `Global ${eventName} handler registered on ${target.name}`,
              mapScriptLoc(script, lineIndex, node.loc),
              "Scope keyboard handlers to the component or guard with self.contains(e.target).",
            );
          }
        }
      }

      if (isCollectionForEach(node, collectionVars)) {
        const callback = node.arguments?.[0];
        if (callback && isFunctionNode(callback)) {
          const paramNames = getFunctionParamNames(callback);
          if (paramNames.size && hasStyleAssignmentsInNode(callback.body, paramNames)) {
            pushWarning(
              warnings,
              "J007",
              "Imperative layout loop setting inline styles on DOM collections",
              mapScriptLoc(script, lineIndex, node.loc),
              "Prefer data-attr-style or bindings instead of manual DOM loops.",
            );
          }
        }
      }
    }

    if (node.type === "ForOfStatement") {
      if (isCollectionExpression(node.right, collectionVars)) {
        const loopVars = getLoopVarNames(node.left);
        if (loopVars.size && hasStyleAssignmentsInNode(node.body, loopVars)) {
          pushWarning(
            warnings,
            "J007",
            "Imperative layout loop setting inline styles on DOM collections",
            mapScriptLoc(script, lineIndex, node.loc),
            "Prefer data-attr-style or bindings instead of manual DOM loops.",
          );
        }
      }
    }

    if (node.type === "ForStatement") {
      const collectionVar = getCollectionVarFromFor(node, collectionVars);
      if (collectionVar) {
        if (hasStyleAssignmentsInNode(node.body, new Set([collectionVar]))) {
          pushWarning(
            warnings,
            "J007",
            "Imperative layout loop setting inline styles on DOM collections",
            mapScriptLoc(script, lineIndex, node.loc),
            "Prefer data-attr-style or bindings instead of manual DOM loops.",
          );
        }
      }
    }

    if (node.type === "MemberExpression") {
      const obj = node.object;
      const propName = getPropName(node);

      if (obj && obj.type === "Identifier" && obj.name === "document") {
        if (propName && DOC_QUERY_METHODS.has(propName)) {
          pushWarning(
            warnings,
            "J001",
            `document.${propName} used in component logic`,
            mapScriptLoc(script, lineIndex, node.loc),
            "Prefer refs or self.querySelector inside the component.",
          );
        }
        if (propName === "activeElement") {
          pushWarning(
            warnings,
            "J005",
            "document.activeElement used inside component logic",
            mapScriptLoc(script, lineIndex, node.loc),
            "Use event.target or e.composedPath() to detect editable inputs.",
          );
        }
      }

      if (propName && HTML_MUTATION_PROPS.has(propName)) {
        if (parent && parent.type === "AssignmentExpression" && parent.left === node) {
          pushWarning(
            warnings,
            "J002",
            `Imperative HTML mutation via ${propName}`,
            mapScriptLoc(script, lineIndex, node.loc),
            "Prefer data-list/data-text bindings over innerHTML mutations.",
          );
        }
      }

      // no data-prop mirroring in Lite

      if (
        obj &&
        obj.type === "Identifier" &&
        (obj.name === "window" || obj.name === "document") &&
        propName === "AudioContext"
      ) {
        needsMediaHint = true;
        if (!mediaHintLoc) mediaHintLoc = mapScriptLoc(script, lineIndex, node.loc);
      }
    }

    if (node.type === "NewExpression" && comp) {
      if (isAudioContextCtor(node.callee)) {
        needsMediaHint = true;
        if (!mediaHintLoc) mediaHintLoc = mapScriptLoc(script, lineIndex, node.loc);
      }
    }

    if (node.type === "AssignmentExpression" && comp) {
      if (isSelectedAssignment(node.left)) {
        comp.selectedAssigned = true;
      }
    }

    if (comp && !comp.hasEditableGuard && isEditableGuardPattern(node)) {
      comp.hasEditableGuard = true;
      if (!comp.editableGuardLoc) comp.editableGuardLoc = mapScriptLoc(script, lineIndex, node.loc);
    }

    if (node.type === "BinaryExpression" || node.type === "LogicalExpression") {
      if (isLiteral(node.left, "keyup") || isLiteral(node.right, "keyup")) {
        keyupChecks.push(node.loc);
      }
    }

    if (node.type === "SwitchCase" && isLiteral(node.test, "keyup")) {
      keyupChecks.push(node.loc);
    }
  });

  if (comp && !comp.hasKeyup && keyupChecks.length) {
    pushWarning(
      warnings,
      "J004",
      "Handler checks for keyup but template has no data-dispatch-keyup",
      mapScriptLoc(script, lineIndex, keyupChecks[0]),
      "Add data-dispatch-keyup to the same element as data-dispatch-keydown.",
    );
  }

  if (needsMediaHint) {
    pushWarning(
      warnings,
      "J009",
      "Audio/canvas usage detected",
      mediaHintLoc,
      "Consider state echoing for audio/canvas so behavior can be tested/verified.",
    );
  }

  return warnings;
}

function walkHtml(node, visit) {
  visit(node);
  if (node.childNodes) {
    node.childNodes.forEach((child) => walkHtml(child, visit));
  }
  if (node.content && node.content.childNodes) {
    node.content.childNodes.forEach((child) => walkHtml(child, visit));
  }
}

function getAttrMap(node) {
  const map = new Map();
  if (!node.attrs) return map;
  node.attrs.forEach((attr) => {
    map.set(attr.name, attr.value);
  });
  return map;
}

function getAttrLocation(node, name) {
  if (!node.sourceCodeLocation || !node.sourceCodeLocation.attrs) return null;
  return node.sourceCodeLocation.attrs[name] || null;
}

function getNodeLocation(node) {
  return node.sourceCodeLocation || null;
}

function unwrapChain(node) {
  if (!node) return null;
  return node.type === "ChainExpression" ? node.expression : node;
}

function getPropertyKeyName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal") return String(node.value);
  return null;
}

function getObjectExpressionKeys(node) {
  const keys = new Set();
  if (!node || node.type !== "ObjectExpression") return keys;
  node.properties.forEach((prop) => {
    if (!prop || prop.type !== "Property" || prop.computed) return;
    const keyName = getPropertyKeyName(prop.key);
    if (keyName != null) keys.add(keyName);
  });
  return keys;
}

function countTemplateDataItems(root) {
  let count = 0;
  const walk = (node, isRoot) => {
    if (!node || !node.tagName) return;
    const attrs = getAttrMap(node);
    if (!isRoot && attrs.has("data-list")) return;
    if (node.tagName.toLowerCase() === "template" && attrs.has("data-item")) {
      count += 1;
    }
    if (node.childNodes) {
      node.childNodes.forEach((child) => walk(child, false));
    }
    if (node.content) {
      walk(node.content, false);
    }
  };
  walk(root, true);
  return count;
}

function findTemplateDataItem(root) {
  let found = null;
  const walk = (node, isRoot) => {
    if (!node || !node.tagName || found) return;
    const attrs = getAttrMap(node);
    if (!isRoot && attrs.has("data-list")) return;
    if (node.tagName.toLowerCase() === "template" && attrs.has("data-item")) {
      found = node;
      return;
    }
    if (node.childNodes) {
      node.childNodes.forEach((child) => walk(child, false));
    }
    if (node.content) {
      walk(node.content, false);
    }
  };
  walk(root, true);
  return found;
}

function findDynamicBindingInTemplate(templateNode) {
  let found = null;
  const isBindingAttr = (name) =>
    EXPRESSION_ATTRS.has(name) ||
    name === "data-class" ||
    name.startsWith("data-arg-") ||
    name.startsWith("data-attr-");

  const hasDynamicToken = (value) => {
    if (!value) return false;
    return /(^|\b)(state|local|item|index)\b/.test(value);
  };

  const walk = (node) => {
    if (!node || found) return;
    if (node.tagName) {
      const attrs = getAttrMap(node);
      for (const [name, value] of attrs.entries()) {
        if (isBindingAttr(name) && hasDynamicToken(value)) {
          found = { name, value, loc: getAttrLocation(node, name) || getNodeLocation(node) };
          return;
        }
      }
    }
    if (node.childNodes) {
      node.childNodes.forEach((child) => walk(child));
    }
    if (node.content) {
      walk(node.content);
    }
  };

  if (templateNode.content) {
    walk(templateNode.content);
  } else {
    walk(templateNode);
  }
  return found;
}

function getTextContent(node) {
  if (!node.childNodes) return "";
  return node.childNodes
    .filter((child) => child.nodeName === "#text")
    .map((child) => child.value)
    .join("");
}

function getScriptContentStartOffset(node) {
  const loc = node.sourceCodeLocation;
  if (loc && loc.startTag && typeof loc.startTag.endOffset === "number") {
    return loc.startTag.endOffset;
  }
  return 0;
}

function getPropName(node) {
  if (node.property) {
    if (node.property.type === "Identifier") return node.property.name;
    if (node.property.type === "Literal") return node.property.value;
  }
  return null;
}

function isOnReference(node, onAliases) {
  if (!node) return false;
  const unwrapped = unwrapChain(node);
  if (unwrapped && unwrapped.type === "Identifier" && onAliases && onAliases.has(unwrapped.name)) {
    return true;
  }
  if (unwrapped && unwrapped.type === "MemberExpression") {
    const propName = getPropertyKeyName(unwrapped.property);
    return propName === "on";
  }
  return false;
}

function getOnCallName(node, onAliases) {
  if (!node || node.type !== "CallExpression") return null;
  const callee = unwrapChain(node.callee);
  if (!callee) return null;
  let isOn = false;
  if (callee.type === "Identifier") {
    isOn = onAliases && onAliases.has(callee.name);
  } else if (callee.type === "MemberExpression") {
    const propName = getPropertyKeyName(callee.property);
    isOn = propName === "on";
  }
  if (!isOn) return null;
  const name = getStringLiteral(node.arguments?.[0]);
  return name || null;
}

function hasOnCallWithParam(node, paramName, onAliases) {
  if (!node || !paramName) return false;
  let found = false;
  walkAst(node, (child) => {
    if (found) return;
    if (child.type !== "CallExpression") return;
    const callee = unwrapChain(child.callee);
    if (!callee) return;
    let isOn = false;
    if (callee.type === "Identifier") {
      isOn = onAliases && onAliases.has(callee.name);
    } else if (callee.type === "MemberExpression") {
      const propName = getPropertyKeyName(callee.property);
      isOn = propName === "on";
    }
    if (!isOn) return;
    const arg = child.arguments?.[0];
    if (arg && arg.type === "Identifier" && arg.name === paramName) {
      found = true;
    }
  });
  return found;
}

function getObjectEntriesInfo(node, objectKeyMap, onAliases, script, lineIndex) {
  if (!node || node.type !== "CallExpression") return null;
  const callee = unwrapChain(node.callee);
  if (!callee || callee.type !== "MemberExpression") return null;
  const propName = getPropertyKeyName(callee.property);
  if (propName !== "forEach") return null;

  const target = callee.object;
  if (!target || target.type !== "CallExpression") return null;
  const targetCallee = unwrapChain(target.callee);
  if (!targetCallee || targetCallee.type !== "MemberExpression") return null;
  const targetProp = getPropertyKeyName(targetCallee.property);
  const targetObj = targetCallee.object;
  if (!targetObj || targetObj.type !== "Identifier" || targetObj.name !== "Object") return null;
  if (targetProp !== "entries" && targetProp !== "keys") return null;

  const arg = target.arguments?.[0];
  if (!arg || arg.type !== "Identifier") return null;
  const entry = objectKeyMap.get(arg.name);
  if (!entry) return null;

  const callback = node.arguments?.[0];
  if (!callback || !isFunctionNode(callback)) return null;

  let keyParam = null;
  if (targetProp === "entries") {
    const param = callback.params?.[0];
    if (param && param.type === "ArrayPattern") {
      const first = param.elements?.[0];
      if (first && first.type === "Identifier") {
        keyParam = first.name;
      }
    }
  } else {
    const param = callback.params?.[0];
    if (param && param.type === "Identifier") {
      keyParam = param.name;
    }
  }

  if (!keyParam) return null;
  if (!hasOnCallWithParam(callback.body, keyParam, onAliases)) return null;

  return {
    keys: entry.keys,
    loc: mapScriptLoc(script, lineIndex, node.loc),
  };
}

function isFunctionNode(node) {
  return node && (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression");
}

function getFunctionParamNames(node) {
  const names = new Set();
  if (!node || !node.params) return names;
  node.params.forEach((param) => {
    if (param.type === "Identifier") {
      names.add(param.name);
    }
  });
  return names;
}

function getLoopVarNames(node) {
  const names = new Set();
  if (!node) return names;
  if (node.type === "Identifier") {
    names.add(node.name);
  } else if (node.type === "VariableDeclaration") {
    node.declarations.forEach((decl) => {
      if (decl.id && decl.id.type === "Identifier") {
        names.add(decl.id.name);
      }
    });
  }
  return names;
}

function isCollectionCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee || callee.type !== "MemberExpression") return false;
  const propName = getPropName(callee);
  return propName && COLLECTION_QUERY_METHODS.has(propName);
}

function isArrayFromCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  return (
    callee &&
    callee.type === "MemberExpression" &&
    callee.object &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Array" &&
    getPropName(callee) === "from"
  );
}

function isArrayFromCollectionCall(node, collectionVars) {
  if (!isArrayFromCall(node)) return false;
  const arg = node.arguments?.[0];
  if (!arg) return false;
  if (isCollectionCall(arg)) return true;
  return arg.type === "Identifier" && collectionVars.has(arg.name);
}

function isCollectionExpression(node, collectionVars) {
  if (!node) return false;
  if (isCollectionCall(node)) return true;
  if (node.type === "Identifier" && collectionVars.has(node.name)) return true;
  if (isArrayFromCollectionCall(node, collectionVars)) return true;
  return false;
}

function isCollectionForEach(node, collectionVars) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee || callee.type !== "MemberExpression") return false;
  if (getPropName(callee) !== "forEach") return false;
  return isCollectionExpression(callee.object, collectionVars);
}

function hasStyleAssignmentsInNode(node, targetNames) {
  let found = false;
  if (!node) return false;
  walkAst(node, (child) => {
    if (found) return;
    if (child.type === "AssignmentExpression") {
      if (isStyleAssignmentTarget(child.left, targetNames)) {
        found = true;
      }
    }
    if (child.type === "CallExpression") {
      if (isStyleSetPropertyCall(child, targetNames)) {
        found = true;
      }
    }
  });
  return found;
}

function isStyleAssignmentTarget(node, targetNames) {
  if (!node || node.type !== "MemberExpression") return false;
  if (!memberExpressionHasProperty(node, "style")) return false;
  const base = getMemberBaseIdentifier(node);
  return base && targetNames.has(base);
}

function isStyleSetPropertyCall(node, targetNames) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee || callee.type !== "MemberExpression") return false;
  if (getPropName(callee) !== "setProperty") return false;
  const obj = callee.object;
  if (!obj || obj.type !== "MemberExpression") return false;
  if (!memberExpressionHasProperty(obj, "style")) return false;
  const base = getMemberBaseIdentifier(obj);
  return base && targetNames.has(base);
}

function memberExpressionHasProperty(node, propName) {
  let current = node;
  while (current && current.type === "MemberExpression") {
    if (getPropName(current) === propName) return true;
    current = current.object;
  }
  return false;
}

function getMemberBaseIdentifier(node) {
  let current = node;
  while (current && current.type === "MemberExpression") {
    const obj = current.object;
    if (!obj) return null;
    if (obj.type === "Identifier") {
      return obj.name;
    }
    if (obj.type === "MemberExpression") {
      current = obj;
      continue;
    }
    return null;
  }
  return null;
}

function getCollectionVarFromFor(node, collectionVars) {
  if (!node || node.type !== "ForStatement") return null;
  const test = node.test;
  if (!test || test.type !== "BinaryExpression") return null;
  const right = test.right;
  if (!right || right.type !== "MemberExpression") return null;
  if (getPropName(right) !== "length") return null;
  const base = getMemberBaseIdentifier(right);
  if (!base) return null;
  return collectionVars.has(base) ? base : null;
}

function getStringLiteral(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked).join("");
  }
  return null;
}

function isLiteral(node, value) {
  return node && node.type === "Literal" && node.value === value;
}

function isValidExpression(expr) {
  if (expr == null) return false;
  const source = String(expr).trim();
  if (!source) return false;
  try {
    acorn.parseExpressionAt(source, 0, { ecmaVersion: "latest" });
    return true;
  } catch (err) {
    return false;
  }
}

function isUnstableKeyExpression(expr) {
  const source = String(expr).trim();
  if (!source) return false;
  if (source === "index" || source === "item.index") return true;
  if (/^['"][^'"]+['"]$/.test(source)) return true;
  if (/^\d+(\.\d+)?$/.test(source)) return true;
  if (/Math\.random\s*\(/.test(source)) return true;
  if (/Date\.now\s*\(/.test(source)) return true;
  if (/new\s+Date\s*\(/.test(source)) return true;
  if (/performance\.now\s*\(/.test(source)) return true;
  return false;
}

function isStaticListExpression(expr) {
  const source = String(expr).trim();
  if (!source) return false;
  if (source.startsWith("[") && source.endsWith("]")) return true;
  if (source.startsWith("Array(")) return true;
  if (source.startsWith("new Array(")) return true;
  if (source.startsWith("{") && source.endsWith("}")) return true;
  if (/^\\d+$/.test(source)) return true;
  return false;
}

function isAudioContextCtor(node) {
  if (!node) return false;
  if (node.type === "Identifier") {
    return node.name === "AudioContext" || node.name === "webkitAudioContext";
  }
  if (node.type === "MemberExpression") {
    const prop = getPropName(node);
    if (prop !== "AudioContext") return false;
    const obj = node.object;
    return obj && obj.type === "Identifier" && (obj.name === "window" || obj.name === "document");
  }
  return false;
}

function stringMentionsEditable(value) {
  if (!value) return false;
  return /input|textarea|select|contenteditable/i.test(value);
}

function isEditableSelectorLiteral(node) {
  const value = getStringLiteral(node);
  return value ? stringMentionsEditable(value) : false;
}

function isEditableTagLiteral(node) {
  const value = getStringLiteral(node);
  if (!value) return false;
  const upper = value.toUpperCase();
  return upper === "INPUT" || upper === "TEXTAREA" || upper === "SELECT" || /CONTENTEDITABLE/i.test(upper);
}

function isTagNameMember(node) {
  return node && node.type === "MemberExpression" && getPropName(node) === "tagName";
}

function isEditableTagComparison(node) {
  if (!node || node.type !== "BinaryExpression") return false;
  if (!["==", "===", "!=", "!=="].includes(node.operator)) return false;
  return (
    (isTagNameMember(node.left) && isEditableTagLiteral(node.right)) ||
    (isTagNameMember(node.right) && isEditableTagLiteral(node.left))
  );
}

function isEditableGuardPattern(node) {
  if (!node) return false;
  if (node.type === "CallExpression") {
    const callee = node.callee;
    if (callee && callee.type === "Identifier") {
      const name = callee.name.toLowerCase();
      if (name.includes("editable") || name.includes("inputtarget") || name.includes("typing")) {
        return true;
      }
    }
    if (callee && callee.type === "MemberExpression") {
      const prop = getPropName(callee);
      if ((prop === "closest" || prop === "matches") && isEditableSelectorLiteral(node.arguments?.[0])) {
        return true;
      }
      if (prop === "composedPath") {
        return true;
      }
    }
  }

  if (node.type === "MemberExpression") {
    const prop = getPropName(node);
    if (prop === "isContentEditable") return true;
  }

  if (node.type === "BinaryExpression") {
    if (isEditableTagComparison(node)) return true;
  }

  if (node.type === "Identifier") {
    const name = node.name.toLowerCase();
    if (name.includes("editable") || name.includes("inputtarget") || name.includes("typing")) {
      return true;
    }
  }

  return false;
}

function isLikelyNonUniqueKeyExpression(expr) {
  const source = String(expr).trim();
  if (!source) return false;
  return /\bitem\.(startTime|endTime|time|timestamp|startedAt|endedAt)\b/.test(source);
}

function containsItemSelected(expr) {
  const source = String(expr);
  return (
    /\bitem\s*\.\s*selected\b/.test(source) ||
    /\bitem\s*\[\s*['"]selected['"]\s*\]/.test(source)
  );
}

function trackItemSelected(comp, expr, loc) {
  if (!comp) return;
  if (!containsItemSelected(expr)) return;
  comp.usesItemSelected = true;
  if (!comp.itemSelectedLoc && loc) {
    comp.itemSelectedLoc = loc;
  }
}

function isSelectedAssignment(node) {
  if (!node || node.type !== "MemberExpression") return false;
  return getPropName(node) === "selected";
}

function walkAst(node, visit) {
  if (!node || typeof node.type !== "string") return;
  const stack = [{ node, parent: null }];
  while (stack.length) {
    const { node: current, parent } = stack.pop();
    visit(current, parent);
    for (const key of Object.keys(current)) {
      const value = current[key];
      if (!value) continue;
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i -= 1) {
          const item = value[i];
          if (item && typeof item.type === "string") {
            stack.push({ node: item, parent: current });
          }
        }
      } else if (value && typeof value.type === "string") {
        stack.push({ node: value, parent: current });
      }
    }
  }
}

function pushWarning(warnings, code, message, loc, suggestion, example) {
  const severity = SEVERITY_BY_CODE[code] || "warning";
  warnings.push({
    code,
    severity,
    message,
    line: loc?.startLine || null,
    col: loc?.startCol || null,
    suggestion,
    example,
  });
}

function mapScriptLoc(script, lineIndex, loc) {
  if (!loc) return null;
  const baseOffset = script.startOffset || 0;
  const offset = baseOffset + loc.start.column + offsetForLine(script.content, loc.start.line);
  const pos = getLineCol(lineIndex, offset);
  return {
    startLine: pos.line,
    startCol: pos.col,
  };
}

function offsetForLine(text, line) {
  if (line <= 1) return 0;
  let idx = 0;
  let current = 1;
  while (current < line && idx < text.length) {
    if (text[idx] === "\n") current += 1;
    idx += 1;
  }
  return idx;
}

function buildLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function getLineCol(lineIndex, index) {
  if (index == null) return null;
  let low = 0;
  let high = lineIndex.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineIndex[mid] <= index) {
      if (mid === lineIndex.length - 1 || lineIndex[mid + 1] > index) {
        const line = mid + 1;
        const col = index - lineIndex[mid] + 1;
        return { line, col };
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return { line: 1, col: index + 1 };
}

module.exports = { validateHtml };
