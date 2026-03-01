//! WASM platform layer for boreDOM.
//!
//! Owns the static memory regions (command buffer + string table) and exposes
//! the exported function surface that the JS runtime calls each frame.
//!
//! Memory layout (all in WASM linear memory):
//! * `command_buffer` — 32 KB, holds the binary command stream.
//! * `string_table`   — 8 KB, holds UTF-8 string payloads.
//! * `events`         — ring buffer for host→Zig DOM events.
//!
//! Frame lifecycle (driven by JS `requestAnimationFrame`):
//! 1. JS calls `boredom_create_instance` / `boredom_destroy_instance` on
//!    custom element connectedCallback / disconnectedCallback.
//! 2. JS calls `boredom_dispatch(node_id, event_id)` for user interactions.
//! 3. JS calls `boredom_frame_tick()` — Zig renders pending instances, drains
//!    events, updates signals, re-renders dirty nodes, and ends with frameEnd().
//! 4. JS reads the command buffer and applies DOM mutations.

const std = @import("std");
const assert = std.debug.assert;
const boredom = @import("boredom");
const command = boredom.command;
const signal_mod = boredom.signal;
const event_ring_mod = boredom.event_ring;
const node_pool_mod = boredom.node_pool;
const app = @import("app");

/// Command region capacity in bytes.
const command_buffer_capacity: u32 = 1024 * 32; // 32 KB

/// String table capacity in bytes.
const string_table_capacity: u32 = 1024 * 8; // 8 KB

/// Maximum node IDs — bumped to 2048 for multi-instance support.
const max_nodes: u16 = 2048;

comptime {
    assert(command_buffer_capacity > 0);
    assert(string_table_capacity > 0);
    assert(command_buffer_capacity + string_table_capacity <= 1024 * 1024);
}

var command_buffer: [command_buffer_capacity]u8 = undefined;
var string_table: [string_table_capacity]u8 = undefined;

var cmd_writer: command.CommandWriter = undefined;
var last_command_len: u32 = 0;
var error_flag: u8 = 0;

// --- Event ring and node pool ---

/// Event ring: 16 slots, power of two for cheap modular arithmetic.
var events: event_ring_mod.RingBuffer(16) = .{};

/// Node ID allocator.
var pool: node_pool_mod.NodePool(max_nodes) = .{};

/// Dirty queue — tracks which nodes need re-rendering after signal changes.
var dirty_queue: signal_mod.DirtyQueue(max_nodes) = .{};

/// Initialize all subsystems.
///
/// Must be called exactly once by JS before the first `boredom_frame_tick`.
export fn boredom_init() void {
    assert(command_buffer.len >= 8);
    command.CommandWriter.init(&cmd_writer, &command_buffer, &string_table);

    // Initialize node pool and app framework.
    pool.init();
    app.init(&pool);

    // Reset event ring and dirty queue.
    events.reset();
    dirty_queue.reset();
}

/// Allocate a node ID from the global pool.
///
/// Used by JS to allocate host element IDs for custom elements.
export fn boredom_alloc_node() u16 {
    return pool.alloc() orelse 0xFFFF;
}

/// Free a node ID back to the global pool.
export fn boredom_free_node(id: u16) void {
    if (id < max_nodes and id >= 1) {
        pool.free(id);
    }
}

/// Create a new component instance.
///
/// Called by JS connectedCallback. Returns the instance ID (or 0xFFFF on failure).
export fn boredom_create_instance(type_id: u16, host_node_id: u16) u16 {
    if (type_id >= app.componentCount()) return 0xFFFF;
    if (host_node_id >= max_nodes) return 0xFFFF;
    return app.createInstance(type_id, host_node_id, &pool);
}

/// Destroy a component instance.
///
/// Called by JS disconnectedCallback. Frees pool slot and emits REMOVE_NODE commands.
export fn boredom_destroy_instance(type_id: u16, instance_id: u16) void {
    if (type_id >= app.componentCount()) return;
    app.destroyInstance(type_id, instance_id, &pool, &cmd_writer);
}

/// Accept a DOM event from the JS host.
export fn boredom_dispatch(node_id: u16, event_id: u8) void {
    assert(event_id > 0);
    _ = events.push(.{
        .node_id = node_id,
        .event_id = event_id,
        .payload = .{0} ** 8,
        .payload_len = 0,
    });
}

/// Accept a DOM event with a two-i32 payload from the JS host.
export fn boredom_dispatch_payload(node_id: u16, event_id: u8, p0: i32, p1: i32) void {
    assert(event_id > 0);
    var payload: [8]u8 = .{0} ** 8;
    std.mem.writeInt(i32, payload[0..4], p0, .little);
    std.mem.writeInt(i32, payload[4..8], p1, .little);
    _ = events.push(.{
        .node_id = node_id,
        .event_id = event_id,
        .payload = payload,
        .payload_len = 8,
    });
}

/// Run one frame of application logic and fill the command buffer.
///
/// Frame phases:
/// 1. Render pending instances (newly created since last frame)
/// 2. Drain event ring → handleEvent → dirty queue
/// 3. Flush dirty queue → updateDirty → command buffer
/// 4. frameEnd
export fn boredom_frame_tick() void {
    if (error_flag != 0) return;

    cmd_writer.reset();

    // 1. Render pending instances
    app.renderPending(&cmd_writer);

    // 2. Drain events
    var drain_count: u8 = 0;
    while (drain_count < 16) : (drain_count += 1) {
        const event = events.pop() orelse break;
        _ = app.handleEvent(&event, &dirty_queue);
    }

    // 3. Flush dirty queue
    var flush_count: u16 = 0;
    while (flush_count < max_nodes) : (flush_count += 1) {
        const node_id = dirty_queue.popNext() orelse break;
        _ = app.updateDirty(node_id, &cmd_writer);
    }

    cmd_writer.frameEnd();
    last_command_len = cmd_writer.commandBytes();
}

/// Pointer to the command buffer region in WASM linear memory.
export fn boredom_get_buffer() [*]const u8 {
    return &command_buffer;
}

/// Number of valid bytes in the command buffer after the last tick.
export fn boredom_get_buffer_len() u32 {
    return last_command_len;
}

/// Pointer to the string table region in WASM linear memory.
export fn boredom_get_string_table() [*]const u8 {
    return &string_table;
}

/// Number of valid bytes in the string table after the last tick.
export fn boredom_get_string_table_len() u32 {
    return cmd_writer.stringBytes();
}

/// Error flag for the JS runtime.
export fn boredom_error_flag() u8 {
    return error_flag;
}

/// Pointer to the component manifest binary blob.
export fn boredom_get_manifest() [*]const u8 {
    const manifest = app.getManifest();
    return manifest.ptr;
}

/// Length of the component manifest blob in bytes.
export fn boredom_get_manifest_len() u32 {
    return app.getManifestLen();
}

/// Number of registered component types.
export fn boredom_component_count() u16 {
    return app.componentCount();
}
