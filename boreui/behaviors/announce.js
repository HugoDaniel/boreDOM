/**
 * announce.js: saying something to a screen reader that the eye reads from the
 * screen.
 *
 * A selection count changing, a filter narrowing a list, an item being removed,
 * an async action finishing: each of these is obvious to someone looking at the
 * page and invisible to someone listening to it. This is how a component says
 * it out loud.
 *
 * Two live regions are made on first use, one polite and one assertive, and a
 * message is a new child appended to one of them. Appending is what makes this
 * work: the regions carry `aria-relevant="additions"`, so a message identical
 * to the one before it is still a new node and is still announced, where
 * replacing the text of a single node would be silently ignored. Each message
 * is removed once it has had time to be read, so the log does not grow for the
 * life of the page.
 *
 * The regions have to be in the document before a message goes into them or
 * Safari drops the first one, so the first announcement of a page waits for
 * them to settle. Call `installAnnouncer()` at startup to have that happen
 * before anyone is waiting on it.
 */

/** How long the regions need to exist before a message put in them is read. */
const SETTLE = 100;
/** How long a message stays in the log before it is taken out again. */
const LINGER = 7000;

/** Clipped to nothing, kept out of the layout, and left readable by a screen reader. */
const HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: "0",
  border: "0",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

let region = null;
let logs = null;
let settled = false;
let ready = null;

function makeLog(live) {
  const log = document.createElement("div");
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", live);
  log.setAttribute("aria-relevant", "additions");
  return log;
}

/**
 * Puts the live regions in the document, once. Worth calling at startup, so the
 * first thing a component has to say does not wait for them.
 *
 * @returns {Promise<void>} resolves when a message put in them will be read
 */
export function installAnnouncer() {
  if (ready) return ready;
  if (!document.body) {
    ready = new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", () => { install(); resolve(settle()); }, { once: true });
    });
    return ready;
  }
  install();
  return (ready = settle());
}

function install() {
  region = document.createElement("div");
  region.dataset.boreuiAnnouncer = "";
  Object.assign(region.style, HIDDEN);
  logs = { polite: makeLog("polite"), assertive: makeLog("assertive") };
  region.append(logs.polite, logs.assertive);
  // First in the body, where a screen reader is most likely to pick it up.
  document.body.prepend(region);
}

const settle = () => new Promise((resolve) => setTimeout(() => { settled = true; resolve(); }, SETTLE));

function put(message, assertive, linger) {
  if (!logs) return;
  const node = document.createElement("div");
  node.textContent = message;
  logs[assertive ? "assertive" : "polite"].append(node);
  if (linger > 0) setTimeout(() => node.remove(), linger);
}

/**
 * Says `message` to a screen reader.
 *
 * @param {string} message  what to say. An empty string says nothing
 * @param {object} [options]
 * @param {boolean} [options.assertive]  interrupt whatever is being read. Reserve it for something the user has to hear now
 * @param {number} [options.linger]  milliseconds the message stays in the log, 7000 by default
 */
export function announce(message, options = {}) {
  if (!message) return;
  const { assertive = false, linger = LINGER } = options;
  const prepared = installAnnouncer();
  if (settled) put(message, assertive, linger);
  else prepared.then(() => put(message, assertive, linger));
}

/** Resolves once every announcement made so far has reached its region. */
export function announced() {
  return ready ?? Promise.resolve();
}

/**
 * Drops messages that have not been read yet. Use it when what they were about
 * has stopped being true, such as a list that was filtered again.
 *
 * @param {object} [options]
 * @param {boolean} [options.assertive]  clear only that region. Both by default
 */
export function clearAnnouncements(options = {}) {
  if (!logs) return;
  const { assertive } = options;
  if (assertive !== true) logs.polite.replaceChildren();
  if (assertive !== false) logs.assertive.replaceChildren();
}

/** Takes the regions out of the document. For tests, and for a page tearing itself down. */
export function destroyAnnouncer() {
  region?.remove();
  region = logs = ready = null;
  settled = false;
}
