"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  boredomPlugin: () => boredomPlugin,
  parseComponentModule: () => parseComponentModule
});
module.exports = __toCommonJS(index_exports);
var import_node_fs = require("fs");
var import_node_path = require("path");
var acorn = __toESM(require("acorn"));
var REQUIRED_EXPORTS = [
  "metadata",
  "style",
  "template",
  "logic"
];
var DEFAULT_COMPONENT_INCLUDE = [/\.([cm]?js)$/];
var DEFAULT_COMPONENT_EXCLUDE = [/\/node_modules\//];
function boredomPlugin(options = {}) {
  const {
    inlineRuntime = true,
    validateComponents = true,
    optimizeStyles = true,
    componentInclude,
    componentExclude
  } = options;
  const includeFilters = normalizeFilters(componentInclude, DEFAULT_COMPONENT_INCLUDE);
  const excludeFilters = normalizeFilters(componentExclude, DEFAULT_COMPONENT_EXCLUDE);
  const componentModules = /* @__PURE__ */ new Map();
  const dependencyGraph = /* @__PURE__ */ new Map();
  let projectRoot = "";
  return {
    name: "vite-plugin-boredom",
    configResolved(config) {
      projectRoot = config.root;
    },
    transform(code, id) {
      const cleanId = normalizeModuleId(id);
      if (!shouldProcessModule(cleanId, includeFilters, excludeFilters)) {
        return null;
      }
      const analysis = analyzeComponentModule(code);
      if (analysis.component) {
        componentModules.set(cleanId, analysis.component);
        dependencyGraph.set(cleanId, analysis.component.metadata.dependencies || []);
      } else {
        componentModules.delete(cleanId);
        dependencyGraph.delete(cleanId);
      }
      if (validateComponents && analysis.issues.length > 0 && analysis.looksLikeComponent) {
        this.warn(formatValidationMessage(cleanId, analysis.issues));
      }
      return null;
    },
    generateBundle(_options, bundle) {
      const htmlFiles = Object.values(bundle).filter(
        (chunk) => typeof chunk === "object" && "fileName" in chunk && chunk.fileName.endsWith(".html")
      );
      htmlFiles.forEach((htmlFile) => {
        const transformedHtml = inlineComponentsToHtml(
          htmlFile.source,
          componentModules,
          dependencyGraph,
          { inlineRuntime, optimizeStyles },
          projectRoot
        );
        htmlFile.source = transformedHtml;
      });
      Object.keys(bundle).forEach((fileName) => {
        if (fileName.endsWith(".js") && fileName !== "boreDOM.js") {
          delete bundle[fileName];
        }
      });
    }
  };
}
function parseComponentModule(code) {
  return analyzeComponentModule(code).component;
}
function analyzeComponentModule(code) {
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module"
    });
  } catch (error) {
    return {
      component: null,
      issues: [`Failed to parse module: ${getErrorMessage(error)}`],
      looksLikeComponent: looksLikeComponentSource(code)
    };
  }
  const bindings = collectTopLevelBindings(ast.body);
  const exports2 = collectExports(ast.body, bindings, code);
  const exportedRequiredNames = REQUIRED_EXPORTS.filter((name) => Boolean(exports2[name]));
  const looksLikeComponent = exportedRequiredNames.includes("metadata") || exportedRequiredNames.length >= 2;
  if (!looksLikeComponent) {
    return { component: null, issues: [], looksLikeComponent: false };
  }
  const fatalIssues = [];
  const issues = [];
  REQUIRED_EXPORTS.forEach((name) => {
    if (!exports2[name]) {
      fatalIssues.push(`Missing required export \`${name}\`.`);
    }
  });
  if (fatalIssues.length > 0) {
    return { component: null, issues: fatalIssues, looksLikeComponent };
  }
  const context = createParseContext(bindings);
  const metadata = parseMetadataExport(exports2.metadata, context, issues, fatalIssues);
  const style = evaluateStringExport(exports2.style, context);
  const template = evaluateStringExport(exports2.template, context);
  const logicSource = extractLogicSource(exports2.logic, code, bindings);
  if (style === null) {
    fatalIssues.push("`style` must resolve to a static string.");
  }
  if (template === null) {
    fatalIssues.push("`template` must resolve to a static string.");
  }
  if (logicSource === null) {
    fatalIssues.push("`logic` must resolve to a function export.");
  }
  if (!metadata || style === null || template === null || logicSource === null || fatalIssues.length > 0) {
    return {
      component: null,
      issues: [...fatalIssues, ...issues],
      looksLikeComponent
    };
  }
  return {
    component: {
      metadata,
      style,
      template,
      logicSource
    },
    issues,
    looksLikeComponent
  };
}
function collectTopLevelBindings(body) {
  const bindings = /* @__PURE__ */ new Map();
  body.forEach((node) => {
    if (node.type === "ExportNamedDeclaration" && node.declaration) {
      registerDeclarationBindings(node.declaration, bindings);
      return;
    }
    registerDeclarationBindings(node, bindings);
  });
  return bindings;
}
function registerDeclarationBindings(node, bindings) {
  if (!node) return;
  if (node.type === "VariableDeclaration") {
    node.declarations.forEach((declarator) => {
      if (declarator.id?.type === "Identifier" && declarator.init) {
        bindings.set(declarator.id.name, declarator.init);
      }
    });
    return;
  }
  if ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") && node.id?.type === "Identifier") {
    bindings.set(node.id.name, node);
  }
}
function collectExports(body, bindings, code) {
  const exports2 = {};
  body.forEach((node) => {
    if (node.type !== "ExportNamedDeclaration") return;
    if (node.declaration?.type === "VariableDeclaration") {
      node.declaration.declarations.forEach((declarator) => {
        if (declarator.id?.type !== "Identifier" || !declarator.init) return;
        exports2[declarator.id.name] = {
          name: declarator.id.name,
          node: declarator.init,
          source: code.slice(declarator.init.start, declarator.init.end)
        };
      });
    } else if ((node.declaration?.type === "FunctionDeclaration" || node.declaration?.type === "ClassDeclaration") && node.declaration.id?.type === "Identifier") {
      const exportName = node.declaration.id.name;
      exports2[exportName] = {
        name: exportName,
        node: node.declaration,
        source: code.slice(node.declaration.start, node.declaration.end)
      };
    }
    (node.specifiers || []).forEach((specifier) => {
      if (specifier.type !== "ExportSpecifier") return;
      const exportName = getExportedName(specifier.exported);
      const localName = getExportedName(specifier.local);
      if (!exportName || !localName) return;
      const localNode = bindings.get(localName) || specifier.local;
      exports2[exportName] = {
        name: exportName,
        node: localNode,
        source: getNodeSource(localNode, code)
      };
    });
  });
  return exports2;
}
function getExportedName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  return null;
}
function createParseContext(bindings) {
  return {
    bindings,
    byNode: /* @__PURE__ */ new WeakMap(),
    byBindingName: /* @__PURE__ */ new Map(),
    resolvingBindings: /* @__PURE__ */ new Set()
  };
}
function evaluateStaticExpression(node, context) {
  if (!node || typeof node !== "object") {
    return { ok: false, value: void 0 };
  }
  const cached = context.byNode.get(node);
  if (cached) return cached;
  const result = evaluateStaticExpressionWithoutCache(node, context);
  context.byNode.set(node, result);
  return result;
}
function evaluateStaticExpressionWithoutCache(node, context) {
  switch (node.type) {
    case "Literal":
      return { ok: true, value: node.value };
    case "TemplateLiteral":
      return evaluateTemplateLiteral(node, context);
    case "ArrayExpression":
      return evaluateArrayExpression(node, context);
    case "ObjectExpression":
      return evaluateObjectExpression(node, context);
    case "Identifier":
      return evaluateIdentifier(node, context);
    case "UnaryExpression":
      return evaluateUnaryExpression(node, context);
    case "BinaryExpression":
      return evaluateBinaryExpression(node, context);
    case "LogicalExpression":
      return evaluateLogicalExpression(node, context);
    case "ConditionalExpression":
      return evaluateConditionalExpression(node, context);
    case "MemberExpression":
      return evaluateMemberExpression(node, context);
    case "CallExpression":
      return evaluateCallExpression(node, context);
    case "ParenthesizedExpression":
      return evaluateStaticExpression(node.expression, context);
    default:
      return { ok: false, value: void 0 };
  }
}
function evaluateIdentifier(node, context) {
  if (node.name === "undefined") {
    return { ok: true, value: void 0 };
  }
  const cached = context.byBindingName.get(node.name);
  if (cached) return cached;
  if (context.resolvingBindings.has(node.name)) {
    return { ok: false, value: void 0 };
  }
  const bindingNode = context.bindings.get(node.name);
  if (!bindingNode) {
    return { ok: false, value: void 0 };
  }
  context.resolvingBindings.add(node.name);
  const result = evaluateStaticExpression(bindingNode, context);
  context.resolvingBindings.delete(node.name);
  context.byBindingName.set(node.name, result);
  return result;
}
function evaluateTemplateLiteral(node, context) {
  let value = "";
  for (let i = 0; i < node.quasis.length; i += 1) {
    value += node.quasis[i]?.value?.cooked ?? "";
    if (i < node.expressions.length) {
      const part = evaluateStaticExpression(node.expressions[i], context);
      if (!part.ok) return { ok: false, value: void 0 };
      value += String(part.value ?? "");
    }
  }
  return { ok: true, value };
}
function evaluateArrayExpression(node, context) {
  const values = [];
  for (const element of node.elements) {
    if (!element) {
      values.push(void 0);
      continue;
    }
    if (element.type === "SpreadElement") {
      const spread = evaluateStaticExpression(element.argument, context);
      if (!spread.ok || !Array.isArray(spread.value)) {
        return { ok: false, value: void 0 };
      }
      values.push(...spread.value);
      continue;
    }
    const item = evaluateStaticExpression(element, context);
    if (!item.ok) {
      return { ok: false, value: void 0 };
    }
    values.push(item.value);
  }
  return { ok: true, value: values };
}
function evaluateObjectExpression(node, context) {
  const objectValue = {};
  for (const prop of node.properties) {
    if (prop.type === "SpreadElement") {
      const spread = evaluateStaticExpression(prop.argument, context);
      if (!spread.ok || !isRecord(spread.value)) {
        return { ok: false, value: void 0 };
      }
      Object.assign(objectValue, spread.value);
      continue;
    }
    if (prop.type !== "Property" || prop.kind !== "init") {
      return { ok: false, value: void 0 };
    }
    const key = resolvePropertyKey(prop, context);
    if (!key.ok) return { ok: false, value: void 0 };
    const value = evaluateStaticExpression(prop.value, context);
    if (!value.ok) return { ok: false, value: void 0 };
    objectValue[key.value] = value.value;
  }
  return { ok: true, value: objectValue };
}
function resolvePropertyKey(prop, context) {
  if (prop.computed) {
    const computed = evaluateStaticExpression(prop.key, context);
    if (!computed.ok) return { ok: false, value: "" };
    if (typeof computed.value !== "string" && typeof computed.value !== "number") {
      return { ok: false, value: "" };
    }
    return { ok: true, value: String(computed.value) };
  }
  if (prop.key.type === "Identifier") {
    return { ok: true, value: prop.key.name };
  }
  if (prop.key.type === "Literal" && (typeof prop.key.value === "string" || typeof prop.key.value === "number")) {
    return { ok: true, value: String(prop.key.value) };
  }
  return { ok: false, value: "" };
}
function evaluateUnaryExpression(node, context) {
  const argument = evaluateStaticExpression(node.argument, context);
  if (!argument.ok) return { ok: false, value: void 0 };
  switch (node.operator) {
    case "+":
      return { ok: true, value: Number(argument.value) };
    case "-":
      return { ok: true, value: -Number(argument.value) };
    case "!":
      return { ok: true, value: !argument.value };
    case "~":
      return { ok: true, value: ~Number(argument.value) };
    case "void":
      return { ok: true, value: void 0 };
    case "typeof":
      return { ok: true, value: typeof argument.value };
    default:
      return { ok: false, value: void 0 };
  }
}
function evaluateBinaryExpression(node, context) {
  const left = evaluateStaticExpression(node.left, context);
  const right = evaluateStaticExpression(node.right, context);
  if (!left.ok || !right.ok) {
    return { ok: false, value: void 0 };
  }
  try {
    switch (node.operator) {
      case "+":
        return { ok: true, value: left.value + right.value };
      case "-":
        return { ok: true, value: left.value - right.value };
      case "*":
        return { ok: true, value: left.value * right.value };
      case "/":
        return { ok: true, value: left.value / right.value };
      case "%":
        return { ok: true, value: left.value % right.value };
      case "**":
        return { ok: true, value: left.value ** right.value };
      case "==":
        return { ok: true, value: left.value == right.value };
      case "!=":
        return { ok: true, value: left.value != right.value };
      case "===":
        return { ok: true, value: left.value === right.value };
      case "!==":
        return { ok: true, value: left.value !== right.value };
      case "<":
        return { ok: true, value: left.value < right.value };
      case "<=":
        return { ok: true, value: left.value <= right.value };
      case ">":
        return { ok: true, value: left.value > right.value };
      case ">=":
        return { ok: true, value: left.value >= right.value };
      case "|":
        return { ok: true, value: left.value | right.value };
      case "^":
        return { ok: true, value: left.value ^ right.value };
      case "&":
        return { ok: true, value: left.value & right.value };
      case "<<":
        return { ok: true, value: left.value << right.value };
      case ">>":
        return { ok: true, value: left.value >> right.value };
      case ">>>":
        return { ok: true, value: left.value >>> right.value };
      default:
        return { ok: false, value: void 0 };
    }
  } catch {
    return { ok: false, value: void 0 };
  }
}
function evaluateLogicalExpression(node, context) {
  const left = evaluateStaticExpression(node.left, context);
  if (!left.ok) return { ok: false, value: void 0 };
  if (node.operator === "&&") {
    if (!left.value) return { ok: true, value: left.value };
    return evaluateStaticExpression(node.right, context);
  }
  if (node.operator === "||") {
    if (left.value) return { ok: true, value: left.value };
    return evaluateStaticExpression(node.right, context);
  }
  if (node.operator === "??") {
    if (left.value !== null && left.value !== void 0) {
      return { ok: true, value: left.value };
    }
    return evaluateStaticExpression(node.right, context);
  }
  return { ok: false, value: void 0 };
}
function evaluateConditionalExpression(node, context) {
  const test = evaluateStaticExpression(node.test, context);
  if (!test.ok) return { ok: false, value: void 0 };
  return evaluateStaticExpression(test.value ? node.consequent : node.alternate, context);
}
function evaluateMemberExpression(node, context) {
  const objectValue = evaluateStaticExpression(node.object, context);
  if (!objectValue.ok || objectValue.value == null) {
    return { ok: false, value: void 0 };
  }
  let propertyKey;
  if (node.computed) {
    const property = evaluateStaticExpression(node.property, context);
    if (!property.ok || typeof property.value !== "string" && typeof property.value !== "number") {
      return { ok: false, value: void 0 };
    }
    propertyKey = property.value;
  } else if (node.property?.type === "Identifier") {
    propertyKey = node.property.name;
  } else if (node.property?.type === "Literal") {
    propertyKey = node.property.value;
  } else {
    return { ok: false, value: void 0 };
  }
  const value = objectValue.value[propertyKey];
  return { ok: true, value };
}
function evaluateCallExpression(node, context) {
  const memberCallName = getMemberCallName(node.callee);
  const args = evaluateCallArguments(node.arguments || [], context);
  if (!args.ok) return { ok: false, value: void 0 };
  if (memberCallName === "Object.assign") {
    const [target, ...sources] = args.value;
    const output = isRecord(target) ? { ...target } : {};
    sources.forEach((source) => {
      if (isRecord(source)) {
        Object.assign(output, source);
      }
    });
    return { ok: true, value: output };
  }
  if (memberCallName === "Object.freeze") {
    return { ok: true, value: args.value[0] };
  }
  if (memberCallName === "Array.from") {
    const input = args.value[0];
    if (Array.isArray(input)) return { ok: true, value: [...input] };
    if (typeof input === "string") return { ok: true, value: Array.from(input) };
    return { ok: false, value: void 0 };
  }
  if (node.callee?.type === "Identifier") {
    const [firstArg] = args.value;
    if (node.callee.name === "String") return { ok: true, value: String(firstArg ?? "") };
    if (node.callee.name === "Number") return { ok: true, value: Number(firstArg) };
    if (node.callee.name === "Boolean") return { ok: true, value: Boolean(firstArg) };
  }
  return { ok: false, value: void 0 };
}
function getMemberCallName(node) {
  if (!node || node.type !== "MemberExpression") return null;
  const objectName = node.object?.type === "Identifier" ? node.object.name : null;
  if (!objectName) return null;
  if (!node.computed && node.property?.type === "Identifier") {
    return `${objectName}.${node.property.name}`;
  }
  if (node.computed && node.property?.type === "Literal" && typeof node.property.value === "string") {
    return `${objectName}.${node.property.value}`;
  }
  return null;
}
function evaluateCallArguments(nodes, context) {
  const values = [];
  for (const arg of nodes) {
    if (arg.type === "SpreadElement") {
      const spread = evaluateStaticExpression(arg.argument, context);
      if (!spread.ok || !Array.isArray(spread.value)) {
        return { ok: false, value: [] };
      }
      values.push(...spread.value);
      continue;
    }
    const value = evaluateStaticExpression(arg, context);
    if (!value.ok) return { ok: false, value: [] };
    values.push(value.value);
  }
  return { ok: true, value: values };
}
function parseMetadataExport(metadataExport, context, issues, fatalIssues) {
  const metadataResult = evaluateStaticExpression(metadataExport.node, context);
  if (!metadataResult.ok || !isRecord(metadataResult.value)) {
    fatalIssues.push("`metadata` must be a statically analyzable object.");
    return null;
  }
  const metadataObj = metadataResult.value;
  const name = metadataObj.name;
  if (typeof name !== "string" || !name.trim()) {
    fatalIssues.push("`metadata.name` must be a non-empty string.");
    return null;
  }
  const version = normalizeOptionalString(metadataObj.version, "metadata.version", issues);
  const dependencies = normalizeStringArray(metadataObj.dependencies, "metadata.dependencies", issues);
  const props = normalizeStringArray(metadataObj.props, "metadata.props", issues);
  const events = normalizeStringArray(metadataObj.events, "metadata.events", issues);
  return {
    name,
    version,
    dependencies,
    props,
    events
  };
}
function normalizeOptionalString(value, fieldName, issues) {
  if (value === void 0) return void 0;
  if (typeof value === "string") return value;
  issues.push(`\`${fieldName}\` should be a string.`);
  return void 0;
}
function normalizeStringArray(value, fieldName, issues) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) {
    issues.push(`\`${fieldName}\` should be an array of strings.`);
    return [];
  }
  const normalized = value.filter((entry) => typeof entry === "string");
  if (normalized.length !== value.length) {
    issues.push(`\`${fieldName}\` should contain only strings.`);
  }
  return normalized;
}
function evaluateStringExport(parsedExport, context) {
  const result = evaluateStaticExpression(parsedExport.node, context);
  if (!result.ok || typeof result.value !== "string") {
    return null;
  }
  return result.value;
}
function extractLogicSource(parsedExport, code, bindings) {
  const resolvedNode = resolveBindingNode(parsedExport.node, bindings);
  const sourceNode = resolvedNode || parsedExport.node;
  if (!sourceNode || !isFunctionNode(sourceNode)) {
    return null;
  }
  return getNodeSource(sourceNode, code);
}
function resolveBindingNode(node, bindings, visited = /* @__PURE__ */ new Set()) {
  if (!node) return null;
  if (node.type !== "Identifier") return node;
  const name = node.name;
  if (!name || visited.has(name)) return null;
  const target = bindings.get(name);
  if (!target) return null;
  visited.add(name);
  return resolveBindingNode(target, bindings, visited) || target;
}
function isFunctionNode(node) {
  return node?.type === "FunctionDeclaration" || node?.type === "FunctionExpression" || node?.type === "ArrowFunctionExpression";
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getNodeSource(node, code) {
  if (typeof node?.start === "number" && typeof node?.end === "number") {
    return code.slice(node.start, node.end);
  }
  return "";
}
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
function normalizeFilters(value, fallback) {
  if (value === void 0) {
    return [...fallback];
  }
  return Array.isArray(value) ? value : [value];
}
function normalizeModuleId(id) {
  return id.split("?")[0].split("#")[0].replace(/\\/g, "/");
}
function shouldProcessModule(id, includeFilters, excludeFilters) {
  if (!id || id.startsWith("\0")) return false;
  if (!matchesAnyFilter(id, includeFilters)) return false;
  if (matchesAnyFilter(id, excludeFilters)) return false;
  return true;
}
function matchesAnyFilter(id, filters) {
  if (!filters.length) return true;
  return filters.some((filter) => matchesFilter(id, filter));
}
function matchesFilter(id, filter) {
  if (typeof filter === "function") {
    return filter(id);
  }
  if (filter instanceof RegExp) {
    return filter.test(id);
  }
  if (filter.startsWith(".")) {
    return id.endsWith(filter);
  }
  return id.includes(filter);
}
function formatValidationMessage(id, issues) {
  return `[vite-plugin-boredom] ${id}
${issues.map((issue) => `  - ${issue}`).join("\n")}`;
}
function looksLikeComponentSource(code) {
  const namedExportPattern = /export\s+(const|let|var|function|class)\s+(metadata|style|template|logic)\b/;
  const exportListPattern = /export\s*{[^}]*\b(metadata|style|template|logic)\b[^}]*}/;
  return namedExportPattern.test(code) || exportListPattern.test(code);
}
function inlineComponentsToHtml(html, components, dependencies, options, projectRoot) {
  const sortedComponents = topologicalSort(components, dependencies);
  const triplets = sortedComponents.map(([id, component]) => {
    const { metadata, style, template, logicSource } = component;
    return `
  <!-- Component: ${metadata.name} -->
  <style data-component="${metadata.name}">
    ${options.optimizeStyles ? optimizeCSS(style) : style}
  </style>
  
  <template data-component="${metadata.name}">
    ${template}
  </template>
  
  <script type="text/boredom" data-component="${metadata.name}">
    export default ${logicSource};
  </script>`;
  });
  const insertPoint = html.lastIndexOf("</body>");
  let result = html;
  if (insertPoint !== -1) {
    result = html.slice(0, insertPoint) + triplets.join("\n") + html.slice(insertPoint);
  }
  if (options.inlineRuntime) {
    const runtimeCode = readBoredomRuntime(projectRoot);
    if (runtimeCode) {
      result = result.replace(
        /<script src="[^"]*boreDOM\.js"([^>]*)><\/script>/,
        `<script$1>
${runtimeCode}
</script>`
      );
    }
  }
  result = result.replace(
    /<script type="module" src="[^"]*main\.js"><\/script>\s*/g,
    ""
  );
  return result;
}
function topologicalSort(components, dependencies) {
  const visited = /* @__PURE__ */ new Set();
  const result = [];
  function visit(componentId) {
    if (visited.has(componentId)) return;
    visited.add(componentId);
    const deps = dependencies.get(componentId) || [];
    deps.forEach((depName) => {
      const depId = findComponentById(components, depName);
      if (depId) visit(depId);
    });
    const component = components.get(componentId);
    if (component) {
      result.push([componentId, component]);
    }
  }
  components.forEach((_, id) => visit(id));
  return result;
}
function findComponentById(components, name) {
  for (const [id, component] of components) {
    if (component.metadata.name === name) {
      return id;
    }
  }
  return null;
}
function optimizeCSS(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
}
function readBoredomRuntime(projectRoot) {
  const possiblePaths = [
    // Project local
    (0, import_node_path.join)(projectRoot, "boreDOM.js"),
    // Relative to this plugin in node_modules
    (0, import_node_path.resolve)(__dirname, "../../../src/boreDOM.js"),
    // Workspace relative
    (0, import_node_path.resolve)(__dirname, "../../../../src/boreDOM.js")
  ];
  for (const runtimePath of possiblePaths) {
    try {
      if ((0, import_node_fs.existsSync)(runtimePath)) {
        return (0, import_node_fs.readFileSync)(runtimePath, "utf-8");
      }
    } catch (_error) {
    }
  }
  console.warn("[vite-plugin-boredom] Could not find boreDOM runtime, using external script");
  return "";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  boredomPlugin,
  parseComponentModule
});
