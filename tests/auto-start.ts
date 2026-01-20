import { getCurrentAppState, setCurrentAppState } from "../src/runtime-state";

const AUTO_STATE_ID = "initial-state";

const removeAutoStartScripts = () => {
  document.querySelectorAll("script[data-state]").forEach((script) =>
    script.remove()
  );
  const stateScript = document.getElementById(AUTO_STATE_ID);
  if (stateScript && stateScript.tagName.toLowerCase() === "script") {
    stateScript.remove();
  }
};

const ensureStateScript = (state: unknown) => {
  const script = document.createElement("script");
  script.type = "application/json";
  script.id = AUTO_STATE_ID;
  script.textContent = JSON.stringify(state ?? {});
  document.body.appendChild(script);
};

const addAutoStartMarker = (hasState: boolean) => {
  const script = document.createElement("script");
  script.setAttribute("data-state", hasState ? `#${AUTO_STATE_ID}` : "");
  document.body.appendChild(script);
};

const waitForAppState = (timeoutMs = 2000) =>
  new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const appState = getCurrentAppState();
      if (appState) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Timed out waiting for boreDOM auto-start"));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });

export const startAuto = async <S>(state?: S) => {
  removeAutoStartScripts();
  if (state !== undefined) {
    ensureStateScript(state);
  }
  addAutoStartMarker(state !== undefined);
  document.dispatchEvent(new Event("DOMContentLoaded"));
  await waitForAppState();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  return getCurrentAppState()?.app as S;
};

export const resetAutoStart = () => {
  removeAutoStartScripts();
  setCurrentAppState(null as any);
};
