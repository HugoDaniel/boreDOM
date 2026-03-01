//! Component interface and shared utilities for boreDOM.
//!
//! Defines the `Metadata` struct that every component must provide, a comptime
//! validator that checks the component contract, and shared utilities like
//! `u32ToStr` that are used across multiple modules.
//!
//! This module also re-exports key types from `command` and `signal` so that
//! component authors only need `@import("boredom")`.

const std = @import("std");
const assert = std.debug.assert;
const command = @import("command.zig");
const signal_mod = @import("signal.zig");
const event_ring_mod = @import("event_ring.zig");

// --- Re-exports for component authors ---

/// Binary command writer — components use this in `render()` and `update()`.
pub const CommandWriter = command.CommandWriter;

/// Sentinel node ID (0xFFFF) — used for "append" in `createNode`.
pub const sentinel_node_id = command.sentinel_node_id;

/// Reactive signal type — components embed these in their `State`.
pub const Signal = signal_mod.Signal;

/// Dirty queue type — used by `handleEvent` to mark nodes for re-render.
pub const DirtyQueue = signal_mod.DirtyQueue;

/// DOM event type discriminators.
pub const EventId = command.EventId;

/// A single DOM event record — used by `handleEvent` to access payload data.
pub const EventRecord = event_ring_mod.EventRecord;

/// Component metadata — every component must export a `pub const metadata: Metadata`.
///
/// Fields:
/// * `name` — the custom element tag name (e.g. "z-counter").
/// * `max_instances` — maximum simultaneous instances (pre-allocated pool size).
pub const Metadata = struct {
    /// Custom element tag name. Must be non-empty and <= 64 bytes.
    name: []const u8,
    /// Maximum simultaneous instances of this component. Defaults to 4.
    max_instances: u16 = 4,
};

/// Validate that a type satisfies the boreDOM component contract at comptime.
///
/// A valid component must have:
/// * `pub const metadata: Metadata`
/// * `pub const style: []const u8` (embedded CSS)
/// * `pub const template: []const u8` (embedded HTML)
/// * `pub const State: type` (a struct)
/// * `pub fn update(*State, *CommandWriter, anytype) void`
/// * `pub fn handleEvent(*State, *const EventRecord, anytype) void`
///
/// Optional (imperative mode):
/// * `pub fn render(*State, *CommandWriter, u16) void`
/// * `pub fn subscribe(*State) void`
///
/// If `render` is absent, the component uses template-mode (auto-rendered from HTML).
/// Derive `tag_slots` from a component's `State.nodes` array length at comptime.
///
/// Returns the array length if the State has a `nodes: [N]u16` field, or 0 if absent.
/// Template-mode components do not need a `nodes` field — the framework injects it.
pub inline fn tagSlotsFromState(comptime C: type) u16 {
    const fields = @typeInfo(C.State).@"struct".fields;
    inline for (fields) |f| {
        if (comptime std.mem.eql(u8, f.name, "nodes")) {
            const info = @typeInfo(f.type);
            if (info == .array and info.array.child == u16) {
                return @intCast(info.array.len);
            }
        }
    }
    return 0; // No nodes field — template-mode component
}

/// Returns true if a component uses imperative mode (has a `render` function).
pub inline fn isImperativeMode(comptime C: type) bool {
    return @hasDecl(C, "render");
}

pub fn validateComponent(comptime C: type) void {
    // 1. Must have metadata
    if (!@hasDecl(C, "metadata")) {
        @compileError("Component missing `pub const metadata: Metadata`");
    }
    const meta = C.metadata;
    assert(meta.name.len > 0); // name must be non-empty
    assert(meta.name.len <= 64); // name must be reasonable length
    assert(meta.max_instances > 0); // must allow at least one instance
    assert(meta.max_instances <= 256); // reasonable upper bound

    // 2. Must have style (embedded CSS bytes)
    if (!@hasDecl(C, "style")) {
        @compileError("Component missing `pub const style: []const u8`");
    }

    // 3. Must have template (embedded HTML bytes)
    if (!@hasDecl(C, "template")) {
        @compileError("Component missing `pub const template: []const u8`");
    }

    // 4. Must have State type
    if (!@hasDecl(C, "State")) {
        @compileError("Component missing `pub const State: type`");
    }
    assert(@sizeOf(C.State) > 0); // State must not be zero-sized

    // 5. Imperative mode requires nodes field and render/subscribe
    if (isImperativeMode(C)) {
        assert(tagSlotsFromState(C) > 0); // imperative mode must have nodes field
        if (!@hasDecl(C, "subscribe")) {
            @compileError("Imperative component missing `pub fn subscribe`");
        }
    }

    // 6. Must have update function
    if (!@hasDecl(C, "update")) {
        @compileError("Component missing `pub fn update`");
    }

    // 7. Must have handleEvent function
    if (!@hasDecl(C, "handleEvent")) {
        @compileError("Component missing `pub fn handleEvent`");
    }
}

/// Convert a u32 to its decimal ASCII representation.
///
/// Returns a slice into the provided buffer containing the digits.
/// The buffer must be at least 16 bytes (max u32 is 10 digits; 16 is generous).
pub fn u32ToStr(val: u32, buf: *[16]u8) []const u8 {
    assert(buf.len >= 1); // buffer must be usable
    if (val == 0) {
        buf[0] = '0';
        return buf[0..1];
    }
    var v = val;
    var pos: u8 = 16;
    // Bounded loop: u32 has at most 10 digits, but we iterate at most 16 times.
    var iterations: u8 = 0;
    while (v > 0 and iterations < 16) : (iterations += 1) {
        pos -= 1;
        buf[pos] = @as(u8, @intCast(v % 10)) + '0';
        v /= 10;
    }
    assert(pos < 16); // at least one digit written
    assert(v == 0); // full value was consumed
    return buf[pos..16];
}

/// Convert an i32 to its decimal ASCII representation.
///
/// Handles negative values by prepending '-'. Delegates magnitude to `u32ToStr`.
/// The buffer must be at least 16 bytes (max i32 is "-2147483648" = 11 chars).
pub fn i32ToStr(val: i32, buf: *[16]u8) []const u8 {
    assert(buf.len >= 1); // buffer must be usable
    if (val == 0) {
        buf[0] = '0';
        assert(buf[0] == '0'); // wrote zero
        return buf[0..1];
    }
    if (val > 0) {
        // Positive — delegate to u32ToStr
        const result = u32ToStr(@as(u32, @intCast(val)), buf);
        assert(result.len >= 1); // at least one digit
        return result;
    }
    // Negative — handle sign prefix
    assert(val < 0); // confirmed negative
    // Special case: i32 min (-2147483648) cannot be negated as i32
    const magnitude: u32 = if (val == std.math.minInt(i32))
        @as(u32, 2147483648)
    else
        @as(u32, @intCast(-val));

    // Convert magnitude into buf[1..16], then prepend '-' at buf[0..pos]
    var tmp: [16]u8 = undefined;
    const mag_str = u32ToStr(magnitude, &tmp);
    assert(mag_str.len >= 1); // at least one digit

    // Place '-' followed by magnitude digits into buf
    const total_len = mag_str.len + 1;
    assert(total_len <= 16); // fits in buffer
    const start: u8 = @intCast(16 - total_len);
    buf[start] = '-';
    var i: u8 = 0;
    while (i < mag_str.len) : (i += 1) {
        buf[start + 1 + i] = mag_str[i];
    }
    assert(buf[start] == '-'); // sign is present
    return buf[start..16];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Mock component that satisfies the full contract — used for testing.
const MockComponent = struct {
    pub const metadata = Metadata{ .name = "z-mock", .max_instances = 4 };
    pub const style = "div { color: red; }";
    pub const template = "<div></div>";
    pub const State = struct { nodes: [2]u16 = .{ 0, 0 }, dummy: u8 = 0 };
    pub fn render(_: *State, _: *CommandWriter, _: u16) void {}
    pub fn update(_: *State, _: *CommandWriter, _: anytype) void {}
    pub fn handleEvent(_: *State, _: *const EventRecord, _: anytype) void {}
    pub fn subscribe(_: *State) void {}
};

test "validateComponent: MockComponent passes validation" {
    // Should not compile-error.
    comptime validateComponent(MockComponent);
}

test "Metadata: size is within bounds" {
    try std.testing.expect(@sizeOf(Metadata) <= 24);
    try std.testing.expect(@sizeOf(Metadata) > 0);
}

test "u32ToStr: zero" {
    var buf: [16]u8 = undefined;
    const result = u32ToStr(0, &buf);
    try std.testing.expectEqualSlices(u8, "0", result);
}

test "u32ToStr: small number" {
    var buf: [16]u8 = undefined;
    const result = u32ToStr(42, &buf);
    try std.testing.expectEqualSlices(u8, "42", result);
}

test "u32ToStr: max u32" {
    var buf: [16]u8 = undefined;
    const result = u32ToStr(4294967295, &buf);
    try std.testing.expectEqualSlices(u8, "4294967295", result);
}

test "u32ToStr: power of ten" {
    var buf: [16]u8 = undefined;
    const result = u32ToStr(1000, &buf);
    try std.testing.expectEqualSlices(u8, "1000", result);
}

test "i32ToStr: zero" {
    var buf: [16]u8 = undefined;
    const result = i32ToStr(0, &buf);
    try std.testing.expectEqualSlices(u8, "0", result);
}

test "i32ToStr: positive" {
    var buf: [16]u8 = undefined;
    const result = i32ToStr(42, &buf);
    try std.testing.expectEqualSlices(u8, "42", result);
}

test "i32ToStr: negative" {
    var buf: [16]u8 = undefined;
    const result = i32ToStr(-7, &buf);
    try std.testing.expectEqualSlices(u8, "-7", result);
}

test "i32ToStr: min i32" {
    var buf: [16]u8 = undefined;
    const result = i32ToStr(-2147483648, &buf);
    try std.testing.expectEqualSlices(u8, "-2147483648", result);
}

test "i32ToStr: max i32" {
    var buf: [16]u8 = undefined;
    const result = i32ToStr(2147483647, &buf);
    try std.testing.expectEqualSlices(u8, "2147483647", result);
}
