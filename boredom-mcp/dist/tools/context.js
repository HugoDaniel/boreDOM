/**
 * Context tools for getting application state and focused error context
 */
/**
 * Register context-related tools
 */
export function registerContextTools(server, bridge) {
    /**
     * Get complete application context
     * Use when you need to understand the full app state, components, and patterns
     */
    server.tool("boredom_get_context", "Get complete boreDOM application context including state shape, components, errors, and patterns. Use this to understand the app before making changes.", {}, async () => {
        if (!bridge.isConnected()) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: "Browser not connected",
                            _meta: {
                                hint: "Include the bridge script in your page: <script src=\"http://localhost:31337\"></script>",
                            },
                        }, null, 2),
                    }],
            };
        }
        try {
            const result = await bridge.call("context");
            // Extract issues for hint generation
            const issues = result.issues;
            const hasErrors = issues?.errors && Array.isArray(issues.errors) && issues.errors.length > 0;
            const meta = {
                suggestedNextTool: hasErrors ? "boredom_get_focus" : "boredom_apply_code",
                hint: hasErrors
                    ? "Errors detected. Use boredom_get_focus for detailed error context."
                    : "App is healthy. Ready for code application.",
            };
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({ ...result, _meta: meta }, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error),
                            _meta: {
                                hint: "Failed to get context. Check if boreDOM is properly initialized.",
                            },
                        }, null, 2),
                    }],
            };
        }
    });
    /**
     * Get focused context for current issue/error
     * Use when fixing a specific error or implementing a targeted feature
     */
    server.tool("boredom_get_focus", "Get focused context for the current issue, error, or feature being worked on. Returns minimal but complete context for the most relevant issue.", {}, async () => {
        if (!bridge.isConnected()) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: "Browser not connected",
                            _meta: {
                                hint: "Include the bridge script in your page: <script src=\"http://localhost:31337\"></script>",
                            },
                        }, null, 2),
                    }],
            };
        }
        try {
            const result = await bridge.call("focus");
            const meta = {
                suggestedNextTool: "boredom_apply_code",
                codeHint: result.suggestion || "Generate code to fix the issue or implement the feature",
            };
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({ ...result, _meta: meta }, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error),
                            _meta: {
                                hint: "Failed to get focused context. Try boredom_get_context for full context.",
                            },
                        }, null, 2),
                    }],
            };
        }
    });
    /**
     * Get history of code application attempts
     * Useful for understanding what's been tried and avoiding repeated mistakes
     */
    server.tool("boredom_get_attempts", "Get history of code application attempts in this session. Useful for understanding what has been tried and avoiding repeated mistakes.", {}, async () => {
        if (!bridge.isConnected()) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: "Browser not connected",
                            attempts: [],
                        }, null, 2),
                    }],
            };
        }
        try {
            const attempts = await bridge.call("getAttempts");
            const errorCount = attempts.filter((a) => a.result === "error").length;
            const meta = {
                hint: errorCount > 0
                    ? `${errorCount} previous errors detected. Avoid repeating failed patterns.`
                    : "No errors in history. Previous attempts were successful.",
            };
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({ attempts, _meta: meta }, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error),
                            attempts: [],
                        }, null, 2),
                    }],
            };
        }
    });
}
//# sourceMappingURL=context.js.map