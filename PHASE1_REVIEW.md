# zigDOM Phase 1 — Code Review

> Reviewed against the Zig Mastery guidelines (`tmp/mastery/zig/ZIG_MASTERY.md`,
> `tmp/mastery/zig/WASM_MASTERY.md`) and the zigDOM architecture plan.
>
> **Verdict:** Phase 1 passes its acceptance criterion — the browser renders the node.
> One critical bug must be fixed before Phase 2. Everything else is documented below in
> priority order.

---

## 1 — Critical: `tick()` does not re-schedule itself — loop runs once

**File:** `web/zigdom.js`

`requestAnimationFrame` fires the callback once for the next paint, then stops.
`tick` must re-schedule itself at the end of each call to form a continuous loop.

```js
// ❌ Current — loop runs exactly one frame
async function init() {
    // ...
    requestAnimationFrame(tick);  // fires once
}

function tick() {
    wasmExports.zigdom_frame_tick();
    // ... no re-schedule
}
```

**Fix:**

```js
function tick() {
    wasmExports.zigdom_frame_tick();

    if (wasmExports.zigdom_error_flag() !== 0) {
        console.error("zigDOM: error flag set — halting loop");
        return; // intentional stop on error
    }

    const ptr = wasmExports.zigdom_get_buffer();
    const len = wasmExports.zigdom_get_buffer_len();
    if (len > 0) processCommandBuffer(ptr, len);

    requestAnimationFrame(tick); // ← re-schedule for next frame
}
```

Phase 1 works today because `run_once` emits content on frame 1 and subsequent ticks
produce only `FRAME_END`. Phase 2 reactivity requires the loop to run continuously.

---

## 2 — Design: Command buffer and string table — adopt Option B (clean separation)

**File:** `src/platform/wasm.zig` + `src/command.zig` + `web/zigdom.js`

### Current approach (Option A — problematic)

```zig
const COMMAND_BUFFER_SIZE = 1024 * 64; // 64 KB
const STRING_TABLE_SIZE   = 1024 * 64; // 64 KB (staging only, not additive)
var command_buffer: [COMMAND_BUFFER_SIZE]u8 = undefined;
var string_table:   [STRING_TABLE_SIZE]u8   = undefined;
```

`finish()` copies the string staging area into `command_buffer` after the commands:

```zig
pub fn finish(self: *CommandWriter) []const u8 {
    const total_len = self.offset + self.string_offset;
    std.debug.assert(total_len <= self.buffer.len); // panics if cmds + strings > 64 KB
    @memcpy(self.buffer[self.offset..total_len], self.string_table[0..self.string_offset]);
    return self.buffer[0..total_len];
}
```

Problems:
- The `STRING_TABLE_SIZE = 64 KB` constant is misleading — it is a staging area, not
  additive capacity. The real combined budget is 64 KB total.
- `finish()` is not idempotent. A second call per tick would re-copy the string table
  over already-valid output data. (Not a current bug; a latent one.)
- The copy is unnecessary allocation work on the hot path.

### Recommended fix: Option B — keep buffers separate, export two regions

Zig exports two independent memory slices. JS reads strings directly from the string
table without any copy.

**`src/platform/wasm.zig`:**

```zig
const std = @import("std");
const command = @import("command");

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);

// Command region: opcodes + node_ids + payload scalars only (no string bytes).
const COMMAND_BUFFER_CAPACITY: u32 = 1024 * 32; // 32 KB — commands are small
// String region: all string payloads for a single frame, read directly by JS.
const STRING_TABLE_CAPACITY:   u32 = 1024 * 8;  //  8 KB — strings per frame are small

var command_buffer: [COMMAND_BUFFER_CAPACITY]u8 = undefined;
var string_table:   [STRING_TABLE_CAPACITY]u8   = undefined;

var cmd_writer: command.CommandWriter = undefined;
var last_command_len: u32 = 0;
var run_once: bool = true;

export fn zigdom_init() void {
    cmd_writer = command.CommandWriter.init(&command_buffer, &string_table);
}

export fn zigdom_frame_tick() void {
    cmd_writer.reset();

    if (run_once) {
        cmd_writer.createNode(1, 1, 0, 0xFFFF); // parent=body, append
        cmd_writer.setText(1, "Hello zigDOM");
        run_once = false;
    }

    cmd_writer.frameEnd();
    last_command_len = cmd_writer.commandBytes();
}

// Command region (opcodes + scalars).
export fn zigdom_get_buffer() [*]const u8 {
    return &command_buffer;
}
export fn zigdom_get_buffer_len() u32 {
    return last_command_len;
}

// String region (raw UTF-8 strings, indexed by offsets in command payloads).
export fn zigdom_get_string_table() [*]const u8 {
    return &string_table;
}
export fn zigdom_get_string_table_len() u32 {
    return cmd_writer.stringBytes();
}

export fn zigdom_error_flag() u8 {
    return 0;
}
```

**`src/command.zig` — replace `finish()` with `commandBytes()` + `stringBytes()`:**

```zig
/// Returns the number of bytes written to the command buffer this frame.
/// JS reads command_buffer[0..commandBytes()].
pub fn commandBytes(self: *const CommandWriter) u32 {
    std.debug.assert(self.offset >= 8); // header always present
    return self.offset;
}

/// Returns the number of string bytes staged this frame.
/// JS reads string_table[0..stringBytes()] via the second export.
pub fn stringBytes(self: *const CommandWriter) u32 {
    return self.string_offset;
}
```

The `finish()` function and `@memcpy` are deleted entirely.

**`web/zigdom.js` — read strings from the second export:**

```js
function processCommandBuffer(ptr, len) {
    const view = new DataView(memory.buffer, ptr, len);

    const command_count     = view.getUint32(0, true);
    const string_table_ptr  = wasmExports.zigdom_get_string_table();
    const string_table_len  = wasmExports.zigdom_get_string_table_len();

    let offset = 8;

    for (let i = 0; i < command_count; i++) {
        const opcode       = view.getUint8(offset);
        const node_id      = view.getUint16(offset + 1, true);
        const payload_len  = view.getUint16(offset + 3, true);
        const payload_offset = offset + 5;

        switch (opcode) {
            case 0x01: { // CREATE_NODE
                const tag_id        = view.getUint8(payload_offset);
                const parent_id     = view.getUint16(payload_offset + 1, true);
                const before_sibling = view.getUint16(payload_offset + 3, true);
                const element = document.createElement(TAG_TABLE[tag_id] || 'div');
                node_map.set(node_id, element);
                const parent = node_map.get(parent_id);
                if (parent) {
                    if (before_sibling === 0xFFFF) {
                        parent.appendChild(element);
                    } else {
                        const sibling = node_map.get(before_sibling);
                        parent.insertBefore(element, sibling || null);
                    }
                }
                break;
            }
            case 0x03: { // SET_TEXT
                const str_offset = view.getUint16(payload_offset,     true);
                const str_len    = view.getUint16(payload_offset + 2, true);
                const text_bytes = new Uint8Array(
                    memory.buffer, string_table_ptr + str_offset, str_len
                );
                const node = node_map.get(node_id);
                if (node) node.textContent = TEXT_DECODER.decode(text_bytes);
                break;
            }
            case 0x0E: // FRAME_END
                break;
            default:
                console.warn("zigDOM: unknown opcode:", opcode);
        }

        offset = payload_offset + payload_len;
    }
}
```

**Benefits of Option B:**
- No `@memcpy` per frame on the hot path.
- Capacities are fully independent — 32 KB commands + 8 KB strings, not a shared 64 KB.
- `CommandWriter` has no `finish()` to mis-call. The write cursor is always the
  valid end of the region.
- The header byte `string_table_offset` (bytes 4–7) is no longer needed; remove it
  from the header to save 4 bytes and eliminate confusion.

---

## 3 — Design: `before_sibling = 0` conflicts with root node ID 0

**File:** `src/command.zig`, `web/zigdom.js`

Node ID `0` maps to `document.body` (root). Using `0` as the sentinel "append at end"
creates an ambiguous encoding: is `before_sibling = 0` "append" or "insert before body"?

**Fix:** use `0xFFFF` as the "append" sentinel (consistent with `FRAME_END` using
`node_id = 0xFFFF`). Already applied in the Option B example above.

```zig
// In createNode — 0xFFFF means append; any other value means insert-before.
pub fn createNode(
    self: *CommandWriter,
    node_id: u16,
    tag_id: u8,
    parent_id: u16,
    before_sibling: u16,  // 0xFFFF = append
) void {
    std.debug.assert(node_id != 0xFFFF); // 0xFFFF is reserved as sentinel
    self.beginCommand(.CREATE_NODE, node_id, 5);
    self.buffer[self.offset] = tag_id;
    self.offset += 1;
    self.write16(parent_id);
    self.write16(before_sibling);
}
```

---

## 4 — Zig Mastery: Missing assertions

**Mastery rule:** minimum 2 assertions per function, assert both positive and negative
space, assert pre- and post-conditions.

Several functions currently have zero assertions:

```zig
// ❌ zigdom_frame_tick — no assertions
export fn zigdom_frame_tick() void {
    cmd_writer.reset();
    // ...
    cmd_writer.frameEnd();
}
```

**Fix example:**

```zig
export fn zigdom_frame_tick() void {
    cmd_writer.reset();
    std.debug.assert(cmd_writer.offset == 8); // reset must restore header reserve

    if (run_once) {
        cmd_writer.createNode(1, 1, 0, 0xFFFF);
        cmd_writer.setText(1, "Hello zigDOM");
        run_once = false;
    }

    cmd_writer.frameEnd();
    std.debug.assert(cmd_writer.command_count >= 1); // at least FRAME_END always present
}
```

Also add to `reset()`:

```zig
pub fn reset(self: *CommandWriter) void {
    self.offset = 8;
    self.command_count = 0;
    self.string_offset = 0;
    std.debug.assert(self.offset == 8);          // post-condition
    std.debug.assert(self.command_count == 0);   // post-condition
}
```

And to `addString()`:

```zig
pub fn addString(self: *CommandWriter, str: []const u8) u16 {
    std.debug.assert(str.len > 0); // empty strings should not enter the table
    std.debug.assert(self.string_offset + str.len <= self.string_table.len);
    // ...
    std.debug.assert(start_offset < self.string_offset); // offset advanced
    return @as(u16, @intCast(start_offset));
}
```

---

## 5 — Zig Mastery: `gpa` variable name is misleading and unused

**File:** `src/platform/wasm.zig`

```zig
// ❌ Current — `gpa` is actually an arena allocator; name is misleading.
//    `_ = gpa` is scaffolding noise.
var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
var gpa = arena.allocator();   // not a GPA — this is an Allocator from the arena

export fn zigdom_init() void {
    cmd_writer = command.CommandWriter.init(&command_buffer, &string_table);
    _ = gpa; // force GPA use
}
```

Mastery naming rule: `gpa` means `GeneralPurposeAllocator` (needs explicit `deinit`),
`arena` means `ArenaAllocator` (doesn't). The variable named `gpa` is actually an
`std.mem.Allocator` view into the arena — a completely different thing.

Since `CommandWriter` is initialized with static arrays (no allocator needed for
Phase 1), the arena is unused entirely. Remove both variables until an allocator is
actually required:

```zig
// ✅ Remove until needed. Static buffers require no allocator.
// var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);

export fn zigdom_init() void {
    cmd_writer = command.CommandWriter.init(&command_buffer, &string_table);
}
```

When an allocator is needed in Phase 2+, introduce it with the correct name:

```zig
var arena: std.heap.ArenaAllocator = undefined;

export fn zigdom_init() void {
    arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    cmd_writer = command.CommandWriter.init(&command_buffer, &string_table);
}
```

---

## 6 — Zig Mastery: Explicitly-sized integer types

**Mastery rule:** use `u32`, `i64`, not `usize` (except for slice indexing).

`CommandWriter` uses `u32` for `offset` and `string_offset` — correct. But
`addString()` casts `str.len` (type `usize`) without comment:

```zig
self.string_offset += @as(u32, @intCast(str.len)); // silent truncation risk
```

Add an assertion to make the intent explicit:

```zig
std.debug.assert(str.len <= std.math.maxInt(u16)); // string length fits in protocol u16
self.string_offset += @as(u32, @intCast(str.len));
```

---

## 7 — JS: `TextDecoder` allocated per `SET_TEXT` command

**File:** `web/zigdom.js`

```js
// ❌ Current — allocates a new TextDecoder object for every SET_TEXT command
const text = new TextDecoder().decode(text_bytes);
```

Create once at module scope:

```js
// ✅ Singleton — no per-command allocation
const TEXT_DECODER = new TextDecoder();
// ...
const text = TEXT_DECODER.decode(text_bytes);
```

---

## 8 — Minor observations

| Item | Note |
|------|------|
| `src/zigdom.zig` re-export | `pub usingnamespace @import("platform/wasm.zig")` makes WASM the default platform. Needs a `comptime builtin.cpu.arch` switch before native targets land. |
| `src/main.zig` / `src/root.zig` | Scaffolding leftover. Not part of the WASM build. Move to `cli/` or delete before Phase 2 to reduce confusion. |
| `TAG_TABLE` in `zigdom.js` | Hardcoded `{ 1: 'div' }`. Per the architecture plan this should be generated by `build.zig` → `tools/codegen.zig` → `web/zigdom_tables.js`. Mark as Phase 2 TODO. |
| `build.zig.zon` version pin | `0.16.0-dev.2623+27eec9bd6` is a specific nightly. Update to a stable release tag when one ships. |
| Header field `string_table_offset` | With Option B adopted, bytes 4–7 of the header are no longer needed (JS uses the second export). Repurpose as a frame sequence number or remove and shrink the header to 4 bytes. |
| WASM binary size | 559 KB is a debug build. `zig build -Doptimize=ReleaseSmall` + `wasm-opt -O3 -Oz` will reduce this dramatically. Measure before claiming the < 50 KB budget goal. |
| No event reverse channel | Expected for Phase 1. `zigdom_dispatch_event(node_id, event_type)` export is absent. Note for Phase 2. |
| `run_once` state | A bare `bool` works for Phase 1 but is a code smell. Phase 2 should replace it with a tagged union state machine: `const Phase = union(enum) { init, running, error_halt };`. |

---

## Summary — what to fix before Phase 2

| Priority | File | Action |
|----------|------|--------|
| **Critical** | `web/zigdom.js` | Add `requestAnimationFrame(tick)` at the end of `tick()` |
| **Required** | `src/platform/wasm.zig` + `src/command.zig` + `web/zigdom.js` | Adopt Option B: export `zigdom_get_string_table()` / `zigdom_get_string_table_len()`; remove `finish()` and the `@memcpy`; fix `COMMAND_BUFFER_CAPACITY` / `STRING_TABLE_CAPACITY` naming |
| **Required** | `src/command.zig` | Change `before_sibling = 0` sentinel to `0xFFFF`; add assertion in `createNode` |
| **Required** | `src/platform/wasm.zig` | Remove unused `gpa` / `arena` variables and `_ = gpa` suppressor |
| Polish | `src/command.zig`, `src/platform/wasm.zig` | Add minimum 2 assertions per function (mastery checklist) |
| Polish | `web/zigdom.js` | Hoist `TEXT_DECODER` to module scope |
| Defer | `src/zigdom.zig`, `src/main.zig`, `src/root.zig` | Platform abstraction + cleanup |
