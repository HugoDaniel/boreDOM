import type { SemanticNode, SemanticAttributes } from "./types";

const IGNORED_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "link",
  "meta",
  "head",
  "title",
]);

const IMPORTANT_ATTRS = new Set([
  "id",
  "class",
  "type",
  "value",
  "checked",
  "disabled",
  "placeholder",
  "href",
  "src",
  "alt",
  "title",
  "role",
]);

function isVisible(element: HTMLElement): boolean {
  if (element.hasAttribute("hidden")) return false;
  if (element.style.display === "none") return false;
  if (element.style.visibility === "hidden") return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  return true;
}

export function getSemanticDOM(element: Element): SemanticNode | null {
  if (!(element instanceof HTMLElement)) return null;
  
  const tagName = element.tagName.toLowerCase();
  
  if (IGNORED_TAGS.has(tagName)) return null;
  if (!isVisible(element)) return null;

  const node: SemanticNode = { tagName };
  const attributes: SemanticAttributes = {};
  let hasAttrs = false;

  // Extract attributes
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name;
    if (IMPORTANT_ATTRS.has(name) || name.startsWith("aria-") || name.startsWith("data-")) {
      // For boolean attributes like checked/disabled, use the property value if possible
      if (name === "checked" || name === "disabled") {
         (attributes as any)[name] = (element as any)[name];
      } else if (name === "value" && (tagName === "input" || tagName === "textarea" || tagName === "select")) {
         // Always take current value for inputs
         (attributes as any)[name] = (element as any).value;
      } else {
        (attributes as any)[name] = attr.value;
      }
      hasAttrs = true;
    }
  }

  if (hasAttrs) node.attributes = attributes;

  // Extract text content (if no children or mixed content)
  // We prefer structure, but for leaf nodes or text-heavy nodes we want text.
  // Strategy: If it has only text nodes, capture text. If mixed, capture text nodes as "text" property?
  // Let's simplify: Concatenate direct text node children.
  let text = "";
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const val = child.nodeValue?.trim();
      if (val) text += val + " ";
    }
  }
  text = text.trim();
  if (text) node.text = text;

  // Recursion
  const children: SemanticNode[] = [];
  for (const child of Array.from(element.children)) {
    const semanticChild = getSemanticDOM(child);
    if (semanticChild) {
      children.push(semanticChild);
    }
  }

  if (children.length > 0) node.children = children;

  // Pruning: specific noise reduction
  // If a div has no attributes, no text, and no children, drop it.
  if (tagName === "div" && !hasAttrs && !text && children.length === 0) return null;

  return node;
}
