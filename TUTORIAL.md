## boreDOM Tutorial

This tutorial covers the boreDOM Zig/WASM framework. It walks through running the demos, understanding the component model, and creating your own component.

---

### 1. Prerequisites

- **Zig** (0.13+) on your PATH
- A local web server (e.g. `python3 -m http.server`)
- A modern browser

### 2. Building

From the project root:

```bash
# Run framework tests
cd lib/boredom && zig build test && cd ../..

# Run component tests
zig build test

# Compile the WASM binary → web/boredom.wasm + web/boredom.js
zig build web
```

### 3. Running the demos

Start a server from the project root:

```bash
python3 -m http.server 8000
```

Then open:

- **Counter demo:** `http://localhost:8000/demo/counter.html` — click "+1" to increment
- **Scroll tracker demo:** `http://localhost:8000/demo/scroll.html` — scroll/trackpad-pan to see X and Y counters update

### 4. How it works end-to-end

```
Browser event → boredom.js → WASM dispatch → Event Ring → Frame Tick
  → Component handleEvent → Signal.set → Dirty Queue
  → Component update → Command Buffer → boredom.js → DOM mutations
```

1. **JS captures** a DOM event and calls a WASM export (`boredom_dispatch` or `boredom_dispatch_payload`)
2. The event lands in a **ring buffer** (`event_ring.zig`)
3. On the next `requestAnimationFrame`, JS calls `boredom_frame_tick`
4. Zig **drains** the ring, routing each `EventRecord` to the owning component's `handleEvent`
5. `handleEvent` updates **signals**, which push subscriber node IDs into the **dirty queue**
6. Zig drains the dirty queue, calling each component's `update` to emit **SET_TEXT** (or other) commands
7. JS reads the **command buffer** and applies the DOM mutations

### 5. The component contract

Every component must export these declarations:

```zig
const boredom = @import("boredom");

pub const metadata = boredom.Metadata{
    .name = "z-my-widget",  // custom element name
    .tag_slots = 3,         // how many DOM nodes this component owns
};

pub const style = @embedFile("my_widget.css");    // scoped CSS
pub const template = @embedFile("my_widget.html"); // reference HTML

pub const State = struct {
    nodes: [3]u16 = .{ 0, 0, 0 },
    // your signals, buffers, etc.
};

pub fn render(state: *State, cmd: *boredom.CommandWriter) void { ... }
pub fn update(state: *State, cmd: *boredom.CommandWriter, dirty_node: u16) void { ... }
pub fn handleEvent(state: *State, event: *const boredom.EventRecord, dirty_queue: anytype) void { ... }
pub fn subscribe(state: *State) void { ... }  // wire signal→node subscriptions
```

### 6. Anatomy of the scroll tracker component

**`scroll_tracker.zig`** is a good reference for the full pattern:

#### State

```zig
pub const State = struct {
    nodes: [5]u16 = .{ 0, 0, 0, 0, 0 },
    scroll_x: Signal(i32, 4) = .{ .value = 0 },  // i32 because deltas are signed
    scroll_y: Signal(i32, 4) = .{ .value = 0 },
    str_buf_x: [16]u8 = undefined,  // scratch for number→string
    str_buf_y: [16]u8 = undefined,
};
```

- `Signal(i32, 4)` — a reactive i32 value with up to 4 subscribers
- Scratch buffers avoid allocation during `update`

#### subscribe — signal-to-node wiring

```zig
pub fn subscribe(state: *State) void {
    state.scroll_x.subscribe(state.nodes[2]);
    state.scroll_y.subscribe(state.nodes[4]);
}
```

Called once during init after node IDs are allocated. Each signal is told which DOM node depends on it, so that `Signal.set()` automatically marks the right nodes dirty.

#### render — initial DOM tree

```zig
pub fn render(state: *State, cmd: *boredom.CommandWriter) void {
    cmd.createNode(container, 1, 0, boredom.sentinel_node_id);   // div under body
    cmd.createNode(x_label, 2, container, boredom.sentinel_node_id); // span
    cmd.createNode(x_value, 2, container, boredom.sentinel_node_id); // span
    cmd.createNode(y_label, 2, container, boredom.sentinel_node_id); // span
    cmd.createNode(y_value, 2, container, boredom.sentinel_node_id); // span

    cmd.setText(x_label, "X:");
    cmd.setText(y_label, "Y:");
    cmd.setText(x_value, boredom.i32ToStr(state.scroll_x.get(), &state.str_buf_x));
    cmd.setText(y_value, boredom.i32ToStr(state.scroll_y.get(), &state.str_buf_y));

    cmd.addListener(container, .wheel);  // register for wheel events
}
```

Tag IDs: `1` = div, `2` = span, `3` = button. The second argument to `createNode` is the tag ID.

#### handleEvent — processing wheel payloads

```zig
pub fn handleEvent(state: *State, event: *const boredom.EventRecord, dirty_queue: anytype) void {
    if (event.event_id == @intFromEnum(boredom.EventId.wheel) and event.node_id == state.nodes[0]) {
        const delta_x = std.mem.readInt(i32, event.payload[0..4], .little);
        const delta_y = std.mem.readInt(i32, event.payload[4..8], .little);

        state.scroll_x.set(state.scroll_x.get() +% delta_x, dirty_queue);
        state.scroll_y.set(state.scroll_y.get() +% delta_y, dirty_queue);
    }
}
```

The `EventRecord.payload` is an 8-byte array. For wheel events, JS packs `deltaX` and `deltaY` as two i32 LE values. The `+%` operator is wrapping addition (no overflow panic).

#### update — re-rendering dirty nodes

```zig
pub fn update(state: *State, cmd: *boredom.CommandWriter, dirty_node: u16) void {
    if (dirty_node == state.nodes[2]) {
        cmd.setText(state.nodes[2], boredom.i32ToStr(state.scroll_x.get(), &state.str_buf_x));
    } else if (dirty_node == state.nodes[4]) {
        cmd.setText(state.nodes[4], boredom.i32ToStr(state.scroll_y.get(), &state.str_buf_y));
    }
}
```

Only the value spans need updating — labels never change.

### 7. Adding a new component

Just drop files into `src/components/` — no build.zig or app.zig changes needed.

**a) Create component files** in `src/components/`:
- `my_widget.zig` (logic — must satisfy the component contract)
- `my_widget.css` (styles — will be auto-scoped)
- `my_widget.html` (template reference)

The `.zig` file must export everything from Section 5, including `subscribe`:

```zig
const boredom = @import("boredom");

pub const metadata = boredom.Metadata{ .name = "z-my-widget", .tag_slots = 2 };
pub const style = @embedFile("my_widget.css");
pub const template = @embedFile("my_widget.html");

pub const State = struct {
    nodes: [2]u16 = .{ 0, 0 },
    value: boredom.Signal(u32, 4) = .{ .value = 0 },
    str_buf: [16]u8 = undefined,
};

pub fn subscribe(state: *State) void {
    // Wire: when `value` changes, mark nodes[1] dirty
    state.value.subscribe(state.nodes[1]);
}

pub fn render(state: *State, cmd: *boredom.CommandWriter) void { ... }
pub fn update(state: *State, cmd: *boredom.CommandWriter, dirty_node: u16) void { ... }
pub fn handleEvent(state: *State, event: *const boredom.EventRecord, dirty_queue: anytype) void { ... }
```

That's it. `build.zig` auto-discovers all `.zig` files in `src/components/`, and `app.zig` uses the auto-generated `components` module. No manual wiring needed.

**b) Add event types (if needed) in `lib/boredom/src/command.zig`:**
```zig
pub const EventId = enum(u8) {
    click = 0x01,
    wheel = 0x02,
    my_event = 0x03,  // new
};
```
And handle it in `lib/boredom/web/boredom.js` by adding to `EVENT_TABLE` and the `ADD_LISTENER` switch.

### 7.1 How the framework works

`app.zig` is ~10 lines. All it does is:

```zig
const boredom = @import("boredom");
const components = @import("components");

const GeneratedApp = boredom.App(components.all, 256);

pub const init = GeneratedApp.init;
pub const renderInitial = GeneratedApp.renderInitial;
pub const handleEvent = GeneratedApp.handleEvent;
pub const updateDirty = GeneratedApp.updateDirty;
pub const getManifest = GeneratedApp.getManifest;
pub const getManifestLen = GeneratedApp.getManifestLen;
```

`boredom.App` takes a component tuple and a max node count, then generates at comptime:

- **State storage** — a `std.meta.Tuple` holding one `State` per component
- **`init(pool)`** — allocates node IDs for each component, calls each component's `subscribe()`
- **`renderInitial(cmd)`** — calls each component's `render()`, adds scoped CSS classes
- **`handleEvent(event, dirty_queue)`** — scans node ownership, dispatches to the right component
- **`updateDirty(dirty_node, cmd)`** — scans node ownership, dispatches to the right component
- **`getManifest()` / `getManifestLen()`** — delegates to `ComponentRegistry`

### 8. Available event types

| ID | Name | Payload | JS dispatch |
|----|-------|---------|-------------|
| `0x01` | `click` | None (0 bytes) | `boredom_dispatch(nid, eid)` |
| `0x02` | `wheel` | deltaX + deltaY (8 bytes, 2×i32 LE) | `boredom_dispatch_payload(nid, eid, deltaX, deltaY)` |

### 9. Available utilities

From `@import("boredom")`:

| Function | Purpose |
|----------|---------|
| `u32ToStr(val, &buf)` | Unsigned int → decimal string slice |
| `i32ToStr(val, &buf)` | Signed int → decimal string slice (handles negatives) |
| `Signal(T, max_sub)` | Reactive value with dirty-queue propagation |
| `EventRecord` | Full event data including 8-byte payload |
| `CommandWriter` | Binary DOM command emitter |

### 10. Coding rules

The codebase follows strict conventions:

- `//!` module-level docs on every file
- `///` doc comments on every public declaration
- At least 2 `assert()` calls per function
- No `usize` except for slice indexing
- All loops bounded with explicit max iterations
- No recursion, max 70 lines per function
- `comptime` size assertions with reasoning comments
- No dynamic allocation anywhere — all memory is static
