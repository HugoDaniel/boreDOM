import type { Bored } from "./dom";
import { access } from "./utils/access";

type BindingScope = {
  state: any;
  detail?: any;
  self: HTMLElement;
  item?: any;
  index?: number;
};

const toCamelCase = (value: string) =>
  value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

const parsePath = (raw: string) => {
  const normalized = raw
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\./, "");
  return normalized.split(".").filter(Boolean);
};

const resolvePath = (target: any, raw: string) => {
  if (target === undefined || target === null) return undefined;
  const path = parsePath(raw);
  if (path.length === 0) return target;
  return access(path, target);
};

const resolveValue = (expr: string, scope: BindingScope) => {
  const raw = expr.trim();
  if (!raw) return undefined;
  if (raw === "index" || raw === "i") return scope.index;
  if (raw === "item") return scope.item;
  if (raw === "detail") return scope.detail;
  if (raw === "self") return scope.self;

  if (raw.startsWith("state.")) return resolvePath(scope.state, raw.slice(6));
  if (raw.startsWith("item.")) return resolvePath(scope.item, raw.slice(5));
  if (raw.startsWith("detail.")) return resolvePath(scope.detail, raw.slice(7));
  if (raw.startsWith("self.")) return resolvePath(scope.self, raw.slice(5));

  return resolvePath(scope.state, raw);
};

const collectElements = (root: Bored | DocumentFragment) => {
  const elements: HTMLElement[] = [];

  if (root instanceof DocumentFragment) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
    );
    while (walker.nextNode()) {
      elements.push(walker.currentNode as HTMLElement);
    }
    return elements;
  }

  elements.push(root);
  root.traverse((elem) => {
    elements.push(elem);
  }, { traverseShadowRoot: true });

  return elements;
};

const getClassBase = (element: HTMLElement) => {
  const stored = element.getAttribute("data-class-base");
  if (stored !== null) return stored;
  const base = element.className;
  element.setAttribute("data-class-base", base);
  return base;
};

const applyClassBinding = (
  element: HTMLElement,
  expr: string,
  scope: BindingScope,
) => {
  const base = getClassBase(element);
  if (expr.includes(":")) {
    const toggled: string[] = [];
    expr.split(",").forEach((part) => {
      const [name, valueExpr] = part.split(":").map((s) => s.trim());
      if (!name || !valueExpr) return;
      if (resolveValue(valueExpr, scope)) {
        toggled.push(name);
      }
    });
    const combined = [base, ...toggled].filter(Boolean).join(" ").trim();
    element.className = combined;
    return;
  }

  const resolved = resolveValue(expr, scope);
  if (typeof resolved === "string") {
    element.className = [base, resolved].filter(Boolean).join(" ").trim();
  } else if (Array.isArray(resolved)) {
    element.className = [base, resolved.join(" ")].filter(Boolean).join(" ")
      .trim();
  } else if (resolved && typeof resolved === "object") {
    const toggled = Object.entries(resolved)
      .filter(([, value]) => Boolean(value))
      .map(([name]) => name);
    element.className = [base, ...toggled].filter(Boolean).join(" ").trim();
  } else {
    element.className = base.trim();
  }
};

const applyAttributeBindings = (elements: HTMLElement[], scope: BindingScope) => {
  const skipListItems = scope.item === undefined;
  elements.forEach((element) => {
    if (element instanceof HTMLTemplateElement) return;
    if (skipListItems && element.closest("[data-list-item]")) return;

    const textBinding = element.getAttribute("data-text");
    if (textBinding) {
      const value = resolveValue(textBinding, scope);
      element.textContent = value === undefined || value === null
        ? ""
        : String(value);
    }

    const showBinding = element.getAttribute("data-show");
    if (showBinding) {
      element.hidden = !Boolean(resolveValue(showBinding, scope));
    }

    const classBinding = element.getAttribute("data-class");
    if (classBinding) {
      applyClassBinding(element, classBinding, scope);
    }

    const valueBinding = element.getAttribute("data-value");
    if (valueBinding && "value" in element) {
      const value = resolveValue(valueBinding, scope);
      (element as HTMLInputElement).value = value === undefined || value === null
        ? ""
        : String(value);
    }

    const checkedBinding = element.getAttribute("data-checked");
    if (checkedBinding && "checked" in element) {
      const value = resolveValue(checkedBinding, scope);
      (element as HTMLInputElement).checked = Boolean(value);
    }

    const propAttributes = Array.from(element.attributes)
      .filter((attr) => attr.name.startsWith("data-prop-"));
    if (propAttributes.length > 0) {
      let detailChanged = false;
      propAttributes.forEach((attr) => {
        const propName = attr.name.slice("data-prop-".length);
        if (!propName) return;
        const resolved = resolveValue(attr.value, scope);
        const dataAttribute = `data-${propName}`;
        const current = element.getAttribute(dataAttribute);
        const isAttributeValue = resolved === undefined || resolved === null ||
          typeof resolved === "string" ||
          typeof resolved === "number" ||
          typeof resolved === "boolean";
        const next = isAttributeValue && resolved !== undefined && resolved !== null
          ? String(resolved)
          : null;
        if (next === null) {
          if (current !== null) {
            element.removeAttribute(dataAttribute);
            detailChanged = true;
          }
        } else if (current !== next) {
          element.setAttribute(dataAttribute, next);
          detailChanged = true;
        }

        const detailKey = toCamelCase(propName);
        const detail = (element as any).__boreDOMDetail;
        if (detail) {
          if (!detail.data) detail.data = {};
          if (detail.data[detailKey] !== resolved) {
            detail.data[detailKey] = resolved;
            detailChanged = true;
          }
        }
      });

      if (detailChanged) {
        const rerender = (element as any).__boreDOMRerender;
        if (typeof rerender === "function") {
          rerender();
        }
      }
    }
  });
};

const applyListBinding = (
  element: HTMLElement,
  scope: BindingScope,
) => {
  const listExpr = element.getAttribute("data-list");
  if (!listExpr) return;

  const template = element.querySelector("template[data-item]");
  if (!(template instanceof HTMLTemplateElement)) return;

  const resolved = resolveValue(listExpr, scope);
  const items = Array.isArray(resolved) ? resolved : [];

  Array.from(element.children).forEach((child) => {
    if ((child as HTMLElement).hasAttribute("data-list-item")) {
      child.remove();
    }
  });

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const clone = template.content.cloneNode(true) as DocumentFragment;
    Array.from(clone.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        (node as HTMLElement).setAttribute("data-list-item", "");
      }
    });
    applyBindingsToFragment(clone, { ...scope, item, index });
    fragment.appendChild(clone);
  });

  element.appendChild(fragment);
};

const applyBindingsToFragment = (
  fragment: DocumentFragment,
  scope: BindingScope,
) => {
  let elements = collectElements(fragment);
  elements.forEach((element) => applyListBinding(element, scope));
  elements = collectElements(fragment);
  applyAttributeBindings(elements, scope);
};

export const applyBindings = (root: Bored, scope: BindingScope) => {
  let elements = collectElements(root);
  elements.forEach((element) => applyListBinding(element, scope));
  elements = collectElements(root);
  applyAttributeBindings(elements, scope);
};
