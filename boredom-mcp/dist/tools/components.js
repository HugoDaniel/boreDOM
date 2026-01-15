/**
 * Component tools for defining and inspecting components
 */
import { z } from "zod";
/**
 * Register component-related tools
 */
export function registerComponentTools(server, bridge) {
    /**
     * Define a new component at runtime
     */
    server.tool("boredom_define_component", "Define a new boreDOM web component at runtime. Creates a custom element that can be used in HTML.", {
        tagName: z.string().describe("Component tag name. Must contain a hyphen (e.g., 'user-card', 'todo-item')."),
        template: z.string().describe("HTML template string. Use data-ref for element references and data-slot for named slots."),
        logic: z.string().optional().describe("Component logic as JavaScript code string. Should be a function that returns { init, render } or uses webComponent() pattern."),
    }, async ({ tagName, template, logic }) => {
        if (!bridge.isConnected()) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            tagName,
                            error: "Browser not connected",
                            _meta: {
                                hint: "Include the bridge script in your page first.",
                            },
                        }, null, 2),
                    }],
            };
        }
        // Validate tag name
        if (!tagName.includes("-")) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            tagName,
                            error: "Invalid tag name: must contain a hyphen (e.g., 'my-component')",
                            _meta: {
                                hint: "Custom element names must contain a hyphen to avoid conflicts with built-in HTML elements.",
                            },
                        }, null, 2),
                    }],
            };
        }
        try {
            const result = await bridge.call("define", { tagName, template, logic });
            const meta = {
                suggestedNextTool: "boredom_get_context",
                hint: result
                    ? `Component <${tagName}> created successfully. Add it to your HTML: <${tagName}></${tagName}>`
                    : `Failed to create component <${tagName}>. Check template syntax and logic code.`,
            };
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: Boolean(result),
                            tagName,
                            _meta: meta,
                        }, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            tagName,
                            error: error instanceof Error ? error.message : String(error),
                            _meta: {
                                hint: "Component creation failed. Check logic code syntax - it should be a valid JavaScript function.",
                            },
                        }, null, 2),
                    }],
            };
        }
    });
    /**
     * Get details of a running component
     */
    server.tool("boredom_get_component", "Get details of a running component instance including its current state, refs, slots, and template.", {
        selector: z.string().describe("CSS selector or tag name to find the component (e.g., 'user-list', '#main-app', '.sidebar todo-list')"),
    }, async ({ selector }) => {
        if (!bridge.isConnected()) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            selector,
                            error: "Browser not connected",
                            component: null,
                        }, null, 2),
                    }],
            };
        }
        try {
            const result = await bridge.call("exportComponent", { selector });
            if (!result) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                selector,
                                component: null,
                                _meta: {
                                    hint: `No component found matching '${selector}'. Check the selector or use boredom_get_context to see available components.`,
                                },
                            }, null, 2),
                        }],
                };
            }
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            selector,
                            ...result,
                            _meta: {
                                hint: `Found component <${result.component}>. Use boredom_apply_code to modify its state or behavior.`,
                            },
                        }, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            selector,
                            error: error instanceof Error ? error.message : String(error),
                            component: null,
                        }, null, 2),
                    }],
            };
        }
    });
    /**
     * Operate on a component (get live access to internals)
     */
    server.tool("boredom_operate_component", "Get live access to a component's internals for inspection. Returns refs, slots, and current state.", {
        selector: z.string().describe("CSS selector or tag name to find the component"),
        index: z.number().optional().describe("If multiple elements match, which one to operate on (0-based)"),
    }, async ({ selector, index }) => {
        if (!bridge.isConnected()) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            selector,
                            error: "Browser not connected",
                            context: null,
                        }, null, 2),
                    }],
            };
        }
        try {
            const result = await bridge.call("operate", { selector, index });
            if (!result) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                selector,
                                context: null,
                                _meta: {
                                    hint: `No component found at '${selector}'${index !== undefined ? ` index ${index}` : ""}. Use boredom_get_context to see available components.`,
                                },
                            }, null, 2),
                        }],
                };
            }
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            selector,
                            context: result,
                            _meta: {
                                hint: "Component context retrieved. Use boredom_apply_code to modify state.",
                            },
                        }, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            selector,
                            error: error instanceof Error ? error.message : String(error),
                            context: null,
                        }, null, 2),
                    }],
            };
        }
    });
}
//# sourceMappingURL=components.js.map