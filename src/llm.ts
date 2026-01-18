import { getSemanticDOM } from "./vision";
import { applyPatch } from "./patch";
import { getCurrentAppState } from "./console-api";
import { flatten } from "./utils/flatten";
import { VERSION } from "./version";
import type { JSONPatchOp, TransactionResult, SemanticNode } from "./types";

// Build-time flag
declare const __DEBUG__: boolean;
declare const __LLM__: boolean;

const isLLMEnabled = typeof __LLM__ !== "undefined"
  ? __LLM__
  : (typeof __DEBUG__ === "undefined" || __DEBUG__);

const _vision = (root?: Element): SemanticNode | null => {
    return getSemanticDOM(root || document.body);
};

const _transact = (patch: JSONPatchOp[]): TransactionResult => {
     const appState = getCurrentAppState();
     if (!appState || !appState.app) {
        return { success: false, error: "No app state found" };
     }
     return applyPatch(appState.app, patch);
};

export const llmAPI = {
  /**
   * Returns a lightweight, semantic JSON tree of the DOM.
   * Use this to "see" the UI structure, attributes, and text without
   * the noise of full DOM nodes. Hidden elements and scripts are ignored.
   * 
   * @returns {SemanticNode | null} The root node of the semantic tree.
   */
  vision: isLLMEnabled ? _vision : () => null,

  /**
   * Safely modifies the app state using a JSON Patch transaction.
   * Supports operations: "add", "remove", "replace", "test".
   * 
   * ATOMICITY: If any operation fails (including a "test"), the entire
   * transaction is rolled back, and the state remains unchanged.
   * 
   * REACTIVITY: Successful patches automatically trigger DOM updates.
   * 
   * @param {JSONPatchOp[]} patch - Array of patch operations.
   * @returns {TransactionResult} { success: true } or { success: false, error: string }
   */
  transact: isLLMEnabled
    ? _transact
    : () => ({ success: false, error: "Production mode" }),

  /**
   * Returns a compact, LLM-friendly summary of the app.
   * Includes framework/version, component list, and state paths.
   */
  compact: isLLMEnabled
    ? () => {
      const appState = getCurrentAppState();
      if (!appState || !appState.app) return null;

      const state = appState.app as Record<string, any>;
      const paths = flatten(state).map((entry) => entry.path.join("."));
      const sample: Record<string, any> = {};

      Object.entries(state).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          sample[key] = `[${value.length}]`;
        } else if (value && typeof value === "object") {
          sample[key] = "{...}";
        } else {
          sample[key] = value;
        }
      });

      const components = Array.from(appState.internal.components.entries())
        .map(([tag, logic]) => ({ tag, hasLogic: Boolean(logic) }));

      return {
        framework: { name: "boreDOM", version: VERSION },
        state: { paths, sample },
        components,
      };
    }
    : () => null,
};
