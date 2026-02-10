import { Plugin } from 'vite';

type ComponentFilter = string | RegExp | ((id: string) => boolean);
interface BoredomPluginOptions {
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
    logicSource: string;
}
declare function boredomPlugin(options?: BoredomPluginOptions): Plugin;
/**
 * Parse a component module using acorn AST parsing
 * Extracts: metadata, style, template, logic exports
 */
declare function parseComponentModule(code: string): ComponentModule | null;

export { type BoredomPluginOptions, boredomPlugin, parseComponentModule };
