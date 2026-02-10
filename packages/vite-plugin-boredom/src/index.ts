import type { Plugin } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as acorn from 'acorn';

type ComponentFilter = string | RegExp | ((id: string) => boolean);
type RequiredExportName = 'metadata' | 'style' | 'template' | 'logic';

export interface BoredomPluginOptions {
  inlineRuntime?: boolean;
  validateComponents?: boolean;
  optimizeStyles?: boolean;
  componentInclude?: ComponentFilter | ComponentFilter[];
  componentExclude?: ComponentFilter | ComponentFilter[];
}

interface ComponentModule {
  metadata: {
    name: string;
    version?: string;
    dependencies?: string[];
    props?: string[];
    events?: string[];
  };
  style: string;
  template: string;
  logicSource: string; // Store as source string, not eval'd function
}

interface ParsedExport {
  name: string;
  node: any;
  source: string;
}

interface StaticEvaluationResult {
  ok: boolean;
  value: unknown;
}

interface ParseContext {
  bindings: Map<string, any>;
  byNode: WeakMap<object, StaticEvaluationResult>;
  byBindingName: Map<string, StaticEvaluationResult>;
  resolvingBindings: Set<string>;
}

interface ComponentAnalysisResult {
  component: ComponentModule | null;
  issues: string[];
  looksLikeComponent: boolean;
}

const REQUIRED_EXPORTS: RequiredExportName[] = [
  'metadata',
  'style',
  'template',
  'logic'
];

const DEFAULT_COMPONENT_INCLUDE: ComponentFilter[] = [/\.([cm]?js)$/];
const DEFAULT_COMPONENT_EXCLUDE: ComponentFilter[] = [/\/node_modules\//];

export function boredomPlugin(options: BoredomPluginOptions = {}): Plugin {
  const {
    inlineRuntime = true,
    validateComponents = true,
    optimizeStyles = true,
    componentInclude,
    componentExclude
  } = options;

  const includeFilters = normalizeFilters(componentInclude, DEFAULT_COMPONENT_INCLUDE);
  const excludeFilters = normalizeFilters(componentExclude, DEFAULT_COMPONENT_EXCLUDE);

  const componentModules = new Map<string, ComponentModule>();
  const dependencyGraph = new Map<string, string[]>();
  let projectRoot = '';

  return {
    name: 'vite-plugin-boredom',

    configResolved(config) {
      projectRoot = config.root;
    },

    transform(code: string, id: string) {
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
        (chunk): chunk is any =>
          typeof chunk === 'object' && 'fileName' in chunk &&
          chunk.fileName.endsWith('.html')
      );

      htmlFiles.forEach(htmlFile => {
        const transformedHtml = inlineComponentsToHtml(
          htmlFile.source as string,
          componentModules,
          dependencyGraph,
          { inlineRuntime, optimizeStyles },
          projectRoot
        );

        htmlFile.source = transformedHtml;
      });

      // Remove JS chunks - everything is now inlined
      Object.keys(bundle).forEach(fileName => {
        if (fileName.endsWith('.js') && fileName !== 'boreDOM.js') {
          delete bundle[fileName];
        }
      });
    }
  };
}

/**
 * Parse a component module using acorn AST parsing
 * Extracts: metadata, style, template, logic exports
 */
function parseComponentModule(code: string): ComponentModule | null {
  return analyzeComponentModule(code).component;
}

function analyzeComponentModule(code: string): ComponentAnalysisResult {
  let ast: any;

  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    });
  } catch (error) {
    return {
      component: null,
      issues: [`Failed to parse module: ${getErrorMessage(error)}`],
      looksLikeComponent: looksLikeComponentSource(code)
    };
  }

  const bindings = collectTopLevelBindings(ast.body);
  const exports = collectExports(ast.body, bindings, code);
  const exportedRequiredNames = REQUIRED_EXPORTS.filter(name => Boolean(exports[name]));
  const looksLikeComponent = (
    exportedRequiredNames.includes('metadata') ||
    exportedRequiredNames.length >= 2
  );

  if (!looksLikeComponent) {
    return { component: null, issues: [], looksLikeComponent: false };
  }

  const fatalIssues: string[] = [];
  const issues: string[] = [];

  REQUIRED_EXPORTS.forEach(name => {
    if (!exports[name]) {
      fatalIssues.push(`Missing required export \`${name}\`.`);
    }
  });

  if (fatalIssues.length > 0) {
    return { component: null, issues: fatalIssues, looksLikeComponent };
  }

  const context = createParseContext(bindings);
  const metadata = parseMetadataExport(exports.metadata as ParsedExport, context, issues, fatalIssues);
  const style = evaluateStringExport(exports.style as ParsedExport, context);
  const template = evaluateStringExport(exports.template as ParsedExport, context);
  const logicSource = extractLogicSource(exports.logic as ParsedExport, code, bindings);

  if (style === null) {
    fatalIssues.push('`style` must resolve to a static string.');
  }

  if (template === null) {
    fatalIssues.push('`template` must resolve to a static string.');
  }

  if (logicSource === null) {
    fatalIssues.push('`logic` must resolve to a function export.');
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

function collectTopLevelBindings(body: any[]): Map<string, any> {
  const bindings = new Map<string, any>();

  body.forEach((node: any) => {
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      registerDeclarationBindings(node.declaration, bindings);
      return;
    }

    registerDeclarationBindings(node, bindings);
  });

  return bindings;
}

function registerDeclarationBindings(node: any, bindings: Map<string, any>) {
  if (!node) return;

  if (node.type === 'VariableDeclaration') {
    node.declarations.forEach((declarator: any) => {
      if (declarator.id?.type === 'Identifier' && declarator.init) {
        bindings.set(declarator.id.name, declarator.init);
      }
    });
    return;
  }

  if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id?.type === 'Identifier') {
    bindings.set(node.id.name, node);
  }
}

function collectExports(body: any[], bindings: Map<string, any>, code: string): Record<string, ParsedExport> {
  const exports: Record<string, ParsedExport> = {};

  body.forEach((node: any) => {
    if (node.type !== 'ExportNamedDeclaration') return;

    if (node.declaration?.type === 'VariableDeclaration') {
      node.declaration.declarations.forEach((declarator: any) => {
        if (declarator.id?.type !== 'Identifier' || !declarator.init) return;

        exports[declarator.id.name] = {
          name: declarator.id.name,
          node: declarator.init,
          source: code.slice(declarator.init.start, declarator.init.end)
        };
      });
    } else if (
      (node.declaration?.type === 'FunctionDeclaration' || node.declaration?.type === 'ClassDeclaration') &&
      node.declaration.id?.type === 'Identifier'
    ) {
      const exportName = node.declaration.id.name;
      exports[exportName] = {
        name: exportName,
        node: node.declaration,
        source: code.slice(node.declaration.start, node.declaration.end)
      };
    }

    (node.specifiers || []).forEach((specifier: any) => {
      if (specifier.type !== 'ExportSpecifier') return;

      const exportName = getExportedName(specifier.exported);
      const localName = getExportedName(specifier.local);
      if (!exportName || !localName) return;

      const localNode = bindings.get(localName) || specifier.local;
      exports[exportName] = {
        name: exportName,
        node: localNode,
        source: getNodeSource(localNode, code)
      };
    });
  });

  return exports;
}

function getExportedName(node: any): string | null {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return null;
}

function createParseContext(bindings: Map<string, any>): ParseContext {
  return {
    bindings,
    byNode: new WeakMap<object, StaticEvaluationResult>(),
    byBindingName: new Map<string, StaticEvaluationResult>(),
    resolvingBindings: new Set<string>()
  };
}

function evaluateStaticExpression(node: any, context: ParseContext): StaticEvaluationResult {
  if (!node || typeof node !== 'object') {
    return { ok: false, value: undefined };
  }

  const cached = context.byNode.get(node);
  if (cached) return cached;

  const result = evaluateStaticExpressionWithoutCache(node, context);
  context.byNode.set(node, result);
  return result;
}

function evaluateStaticExpressionWithoutCache(node: any, context: ParseContext): StaticEvaluationResult {
  switch (node.type) {
    case 'Literal':
      return { ok: true, value: node.value };

    case 'TemplateLiteral':
      return evaluateTemplateLiteral(node, context);

    case 'ArrayExpression':
      return evaluateArrayExpression(node, context);

    case 'ObjectExpression':
      return evaluateObjectExpression(node, context);

    case 'Identifier':
      return evaluateIdentifier(node, context);

    case 'UnaryExpression':
      return evaluateUnaryExpression(node, context);

    case 'BinaryExpression':
      return evaluateBinaryExpression(node, context);

    case 'LogicalExpression':
      return evaluateLogicalExpression(node, context);

    case 'ConditionalExpression':
      return evaluateConditionalExpression(node, context);

    case 'MemberExpression':
      return evaluateMemberExpression(node, context);

    case 'CallExpression':
      return evaluateCallExpression(node, context);

    case 'ParenthesizedExpression':
      return evaluateStaticExpression(node.expression, context);

    default:
      return { ok: false, value: undefined };
  }
}

function evaluateIdentifier(node: any, context: ParseContext): StaticEvaluationResult {
  if (node.name === 'undefined') {
    return { ok: true, value: undefined };
  }

  const cached = context.byBindingName.get(node.name);
  if (cached) return cached;

  if (context.resolvingBindings.has(node.name)) {
    return { ok: false, value: undefined };
  }

  const bindingNode = context.bindings.get(node.name);
  if (!bindingNode) {
    return { ok: false, value: undefined };
  }

  context.resolvingBindings.add(node.name);
  const result = evaluateStaticExpression(bindingNode, context);
  context.resolvingBindings.delete(node.name);
  context.byBindingName.set(node.name, result);
  return result;
}

function evaluateTemplateLiteral(node: any, context: ParseContext): StaticEvaluationResult {
  let value = '';

  for (let i = 0; i < node.quasis.length; i += 1) {
    value += node.quasis[i]?.value?.cooked ?? '';

    if (i < node.expressions.length) {
      const part = evaluateStaticExpression(node.expressions[i], context);
      if (!part.ok) return { ok: false, value: undefined };
      value += String(part.value ?? '');
    }
  }

  return { ok: true, value };
}

function evaluateArrayExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const values: unknown[] = [];

  for (const element of node.elements) {
    if (!element) {
      values.push(undefined);
      continue;
    }

    if (element.type === 'SpreadElement') {
      const spread = evaluateStaticExpression(element.argument, context);
      if (!spread.ok || !Array.isArray(spread.value)) {
        return { ok: false, value: undefined };
      }
      values.push(...spread.value);
      continue;
    }

    const item = evaluateStaticExpression(element, context);
    if (!item.ok) {
      return { ok: false, value: undefined };
    }
    values.push(item.value);
  }

  return { ok: true, value: values };
}

function evaluateObjectExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const objectValue: Record<string, unknown> = {};

  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement') {
      const spread = evaluateStaticExpression(prop.argument, context);
      if (!spread.ok || !isRecord(spread.value)) {
        return { ok: false, value: undefined };
      }
      Object.assign(objectValue, spread.value);
      continue;
    }

    if (prop.type !== 'Property' || prop.kind !== 'init') {
      return { ok: false, value: undefined };
    }

    const key = resolvePropertyKey(prop, context);
    if (!key.ok) return { ok: false, value: undefined };

    const value = evaluateStaticExpression(prop.value, context);
    if (!value.ok) return { ok: false, value: undefined };

    objectValue[key.value] = value.value;
  }

  return { ok: true, value: objectValue };
}

function resolvePropertyKey(prop: any, context: ParseContext): { ok: boolean; value: string } {
  if (prop.computed) {
    const computed = evaluateStaticExpression(prop.key, context);
    if (!computed.ok) return { ok: false, value: '' };
    if (typeof computed.value !== 'string' && typeof computed.value !== 'number') {
      return { ok: false, value: '' };
    }
    return { ok: true, value: String(computed.value) };
  }

  if (prop.key.type === 'Identifier') {
    return { ok: true, value: prop.key.name };
  }

  if (
    prop.key.type === 'Literal' &&
    (typeof prop.key.value === 'string' || typeof prop.key.value === 'number')
  ) {
    return { ok: true, value: String(prop.key.value) };
  }

  return { ok: false, value: '' };
}

function evaluateUnaryExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const argument = evaluateStaticExpression(node.argument, context);
  if (!argument.ok) return { ok: false, value: undefined };

  switch (node.operator) {
    case '+':
      return { ok: true, value: Number(argument.value) };
    case '-':
      return { ok: true, value: -Number(argument.value) };
    case '!':
      return { ok: true, value: !argument.value };
    case '~':
      return { ok: true, value: ~Number(argument.value) };
    case 'void':
      return { ok: true, value: undefined };
    case 'typeof':
      return { ok: true, value: typeof argument.value };
    default:
      return { ok: false, value: undefined };
  }
}

function evaluateBinaryExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const left = evaluateStaticExpression(node.left, context);
  const right = evaluateStaticExpression(node.right, context);

  if (!left.ok || !right.ok) {
    return { ok: false, value: undefined };
  }

  try {
    switch (node.operator) {
      case '+': return { ok: true, value: (left.value as any) + (right.value as any) };
      case '-': return { ok: true, value: (left.value as any) - (right.value as any) };
      case '*': return { ok: true, value: (left.value as any) * (right.value as any) };
      case '/': return { ok: true, value: (left.value as any) / (right.value as any) };
      case '%': return { ok: true, value: (left.value as any) % (right.value as any) };
      case '**': return { ok: true, value: (left.value as any) ** (right.value as any) };
      case '==': return { ok: true, value: (left.value as any) == (right.value as any) };
      case '!=': return { ok: true, value: (left.value as any) != (right.value as any) };
      case '===': return { ok: true, value: left.value === right.value };
      case '!==': return { ok: true, value: left.value !== right.value };
      case '<': return { ok: true, value: (left.value as any) < (right.value as any) };
      case '<=': return { ok: true, value: (left.value as any) <= (right.value as any) };
      case '>': return { ok: true, value: (left.value as any) > (right.value as any) };
      case '>=': return { ok: true, value: (left.value as any) >= (right.value as any) };
      case '|': return { ok: true, value: (left.value as any) | (right.value as any) };
      case '^': return { ok: true, value: (left.value as any) ^ (right.value as any) };
      case '&': return { ok: true, value: (left.value as any) & (right.value as any) };
      case '<<': return { ok: true, value: (left.value as any) << (right.value as any) };
      case '>>': return { ok: true, value: (left.value as any) >> (right.value as any) };
      case '>>>': return { ok: true, value: (left.value as any) >>> (right.value as any) };
      default: return { ok: false, value: undefined };
    }
  } catch {
    return { ok: false, value: undefined };
  }
}

function evaluateLogicalExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const left = evaluateStaticExpression(node.left, context);
  if (!left.ok) return { ok: false, value: undefined };

  if (node.operator === '&&') {
    if (!left.value) return { ok: true, value: left.value };
    return evaluateStaticExpression(node.right, context);
  }

  if (node.operator === '||') {
    if (left.value) return { ok: true, value: left.value };
    return evaluateStaticExpression(node.right, context);
  }

  if (node.operator === '??') {
    if (left.value !== null && left.value !== undefined) {
      return { ok: true, value: left.value };
    }
    return evaluateStaticExpression(node.right, context);
  }

  return { ok: false, value: undefined };
}

function evaluateConditionalExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const test = evaluateStaticExpression(node.test, context);
  if (!test.ok) return { ok: false, value: undefined };

  return evaluateStaticExpression(test.value ? node.consequent : node.alternate, context);
}

function evaluateMemberExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const objectValue = evaluateStaticExpression(node.object, context);
  if (!objectValue.ok || objectValue.value == null) {
    return { ok: false, value: undefined };
  }

  let propertyKey: string | number;
  if (node.computed) {
    const property = evaluateStaticExpression(node.property, context);
    if (!property.ok || (typeof property.value !== 'string' && typeof property.value !== 'number')) {
      return { ok: false, value: undefined };
    }
    propertyKey = property.value;
  } else if (node.property?.type === 'Identifier') {
    propertyKey = node.property.name;
  } else if (node.property?.type === 'Literal') {
    propertyKey = node.property.value;
  } else {
    return { ok: false, value: undefined };
  }

  const value = (objectValue.value as any)[propertyKey];
  return { ok: true, value };
}

function evaluateCallExpression(node: any, context: ParseContext): StaticEvaluationResult {
  const memberCallName = getMemberCallName(node.callee);
  const args = evaluateCallArguments(node.arguments || [], context);
  if (!args.ok) return { ok: false, value: undefined };

  if (memberCallName === 'Object.assign') {
    const [target, ...sources] = args.value;
    const output: Record<string, unknown> = isRecord(target) ? { ...target } : {};
    sources.forEach(source => {
      if (isRecord(source)) {
        Object.assign(output, source);
      }
    });
    return { ok: true, value: output };
  }

  if (memberCallName === 'Object.freeze') {
    return { ok: true, value: args.value[0] };
  }

  if (memberCallName === 'Array.from') {
    const input = args.value[0];
    if (Array.isArray(input)) return { ok: true, value: [...input] };
    if (typeof input === 'string') return { ok: true, value: Array.from(input) };
    return { ok: false, value: undefined };
  }

  if (node.callee?.type === 'Identifier') {
    const [firstArg] = args.value;
    if (node.callee.name === 'String') return { ok: true, value: String(firstArg ?? '') };
    if (node.callee.name === 'Number') return { ok: true, value: Number(firstArg) };
    if (node.callee.name === 'Boolean') return { ok: true, value: Boolean(firstArg) };
  }

  return { ok: false, value: undefined };
}

function getMemberCallName(node: any): string | null {
  if (!node || node.type !== 'MemberExpression') return null;

  const objectName = node.object?.type === 'Identifier' ? node.object.name : null;
  if (!objectName) return null;

  if (!node.computed && node.property?.type === 'Identifier') {
    return `${objectName}.${node.property.name}`;
  }

  if (node.computed && node.property?.type === 'Literal' && typeof node.property.value === 'string') {
    return `${objectName}.${node.property.value}`;
  }

  return null;
}

function evaluateCallArguments(nodes: any[], context: ParseContext): { ok: boolean; value: unknown[] } {
  const values: unknown[] = [];

  for (const arg of nodes) {
    if (arg.type === 'SpreadElement') {
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

function parseMetadataExport(
  metadataExport: ParsedExport,
  context: ParseContext,
  issues: string[],
  fatalIssues: string[]
): ComponentModule['metadata'] | null {
  const metadataResult = evaluateStaticExpression(metadataExport.node, context);
  if (!metadataResult.ok || !isRecord(metadataResult.value)) {
    fatalIssues.push('`metadata` must be a statically analyzable object.');
    return null;
  }

  const metadataObj = metadataResult.value as Record<string, unknown>;
  const name = metadataObj.name;

  if (typeof name !== 'string' || !name.trim()) {
    fatalIssues.push('`metadata.name` must be a non-empty string.');
    return null;
  }

  const version = normalizeOptionalString(metadataObj.version, 'metadata.version', issues);
  const dependencies = normalizeStringArray(metadataObj.dependencies, 'metadata.dependencies', issues);
  const props = normalizeStringArray(metadataObj.props, 'metadata.props', issues);
  const events = normalizeStringArray(metadataObj.events, 'metadata.events', issues);

  return {
    name,
    version,
    dependencies,
    props,
    events
  };
}

function normalizeOptionalString(
  value: unknown,
  fieldName: string,
  issues: string[]
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;

  issues.push(`\`${fieldName}\` should be a string.`);
  return undefined;
}

function normalizeStringArray(
  value: unknown,
  fieldName: string,
  issues: string[]
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(`\`${fieldName}\` should be an array of strings.`);
    return [];
  }

  const normalized = value.filter((entry): entry is string => typeof entry === 'string');
  if (normalized.length !== value.length) {
    issues.push(`\`${fieldName}\` should contain only strings.`);
  }

  return normalized;
}

function evaluateStringExport(parsedExport: ParsedExport, context: ParseContext): string | null {
  const result = evaluateStaticExpression(parsedExport.node, context);
  if (!result.ok || typeof result.value !== 'string') {
    return null;
  }
  return result.value;
}

function extractLogicSource(
  parsedExport: ParsedExport,
  code: string,
  bindings: Map<string, any>
): string | null {
  const resolvedNode = resolveBindingNode(parsedExport.node, bindings);
  const sourceNode = resolvedNode || parsedExport.node;

  if (!sourceNode || !isFunctionNode(sourceNode)) {
    return null;
  }

  return getNodeSource(sourceNode, code);
}

function resolveBindingNode(
  node: any,
  bindings: Map<string, any>,
  visited = new Set<string>()
): any | null {
  if (!node) return null;
  if (node.type !== 'Identifier') return node;

  const name = node.name;
  if (!name || visited.has(name)) return null;

  const target = bindings.get(name);
  if (!target) return null;

  visited.add(name);
  return resolveBindingNode(target, bindings, visited) || target;
}

function isFunctionNode(node: any): boolean {
  return (
    node?.type === 'FunctionDeclaration' ||
    node?.type === 'FunctionExpression' ||
    node?.type === 'ArrowFunctionExpression'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNodeSource(node: any, code: string): string {
  if (typeof node?.start === 'number' && typeof node?.end === 'number') {
    return code.slice(node.start, node.end);
  }
  return '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeFilters(
  value: ComponentFilter | ComponentFilter[] | undefined,
  fallback: ComponentFilter[]
): ComponentFilter[] {
  if (value === undefined) {
    return [...fallback];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeModuleId(id: string): string {
  return id
    .split('?')[0]
    .split('#')[0]
    .replace(/\\/g, '/');
}

function shouldProcessModule(id: string, includeFilters: ComponentFilter[], excludeFilters: ComponentFilter[]): boolean {
  if (!id || id.startsWith('\0')) return false;
  if (!matchesAnyFilter(id, includeFilters)) return false;
  if (matchesAnyFilter(id, excludeFilters)) return false;
  return true;
}

function matchesAnyFilter(id: string, filters: ComponentFilter[]): boolean {
  if (!filters.length) return true;
  return filters.some(filter => matchesFilter(id, filter));
}

function matchesFilter(id: string, filter: ComponentFilter): boolean {
  if (typeof filter === 'function') {
    return filter(id);
  }

  if (filter instanceof RegExp) {
    return filter.test(id);
  }

  if (filter.startsWith('.')) {
    return id.endsWith(filter);
  }

  return id.includes(filter);
}

function formatValidationMessage(id: string, issues: string[]): string {
  return `[vite-plugin-boredom] ${id}\n${issues.map(issue => `  - ${issue}`).join('\n')}`;
}

function looksLikeComponentSource(code: string): boolean {
  const namedExportPattern = /export\s+(const|let|var|function|class)\s+(metadata|style|template|logic)\b/;
  const exportListPattern = /export\s*{[^}]*\b(metadata|style|template|logic)\b[^}]*}/;
  return namedExportPattern.test(code) || exportListPattern.test(code);
}

function inlineComponentsToHtml(
  html: string,
  components: Map<string, ComponentModule>,
  dependencies: Map<string, string[]>,
  options: { inlineRuntime: boolean; optimizeStyles: boolean },
  projectRoot: string
): string {
  // Sort components by dependency order
  const sortedComponents = topologicalSort(components, dependencies);

  // Generate component triplets
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

  // Insert before closing body tag
  const insertPoint = html.lastIndexOf('</body>');
  let result = html;

  if (insertPoint !== -1) {
    result = html.slice(0, insertPoint) + triplets.join('\n') + html.slice(insertPoint);
  }

  // Inline boreDOM runtime if requested
  if (options.inlineRuntime) {
    const runtimeCode = readBoredomRuntime(projectRoot);
    if (runtimeCode) {
      // Match any boreDOM.js script src path
      result = result.replace(
        /<script src="[^"]*boreDOM\.js"([^>]*)><\/script>/,
        `<script$1>\n${runtimeCode}\n</script>`
      );
    }
  }

  // Remove the main.js module script since components are now inlined
  result = result.replace(
    /<script type="module" src="[^"]*main\.js"><\/script>\s*/g,
    ''
  );

  return result;
}

function topologicalSort(
  components: Map<string, ComponentModule>,
  dependencies: Map<string, string[]>
): Array<[string, ComponentModule]> {
  const visited = new Set<string>();
  const result: Array<[string, ComponentModule]> = [];

  function visit(componentId: string) {
    if (visited.has(componentId)) return;
    visited.add(componentId);

    const deps = dependencies.get(componentId) || [];
    deps.forEach(depName => {
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

function findComponentById(components: Map<string, ComponentModule>, name: string): string | null {
  for (const [id, component] of components) {
    if (component.metadata.name === name) {
      return id;
    }
  }
  return null;
}

function optimizeCSS(css: string): string {
  // Basic CSS optimization - remove comments and extra whitespace
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readBoredomRuntime(projectRoot: string): string {
  // Try multiple locations for boreDOM.js
  const possiblePaths = [
    // Project local
    join(projectRoot, 'boreDOM.js'),
    // Relative to this plugin in node_modules
    resolve(__dirname, '../../../src/boreDOM.js'),
    // Workspace relative
    resolve(__dirname, '../../../../src/boreDOM.js'),
  ];

  for (const runtimePath of possiblePaths) {
    try {
      if (existsSync(runtimePath)) {
        return readFileSync(runtimePath, 'utf-8');
      }
    } catch (_error) {
      // Continue to next path
    }
  }

  console.warn('[vite-plugin-boredom] Could not find boreDOM runtime, using external script');
  return '';
}

// Re-export for external use
export { parseComponentModule };
