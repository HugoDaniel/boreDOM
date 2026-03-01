//! Comptime component registry for boreDOM.
//!
//! Collects all registered component types, validates them, and packs a binary
//! manifest that the JS runtime reads at init to inject `<style>` tags.
//!
//! All work is done at comptime — no runtime allocation.

const std = @import("std");
const assert = std.debug.assert;
const component = @import("component.zig");
const event_ring_mod = @import("event_ring.zig");

/// Build the binary manifest blob at comptime.
///
/// Format:
/// ```
/// Header (4 bytes):
///   [0..2] component_count : u16 LE
///   [2..4] reserved (0)
///
/// Per-component entry (12 bytes each):
///   [0..2]  name_offset  : u16 LE  (into string pool)
///   [2..4]  name_len     : u16 LE
///   [4..6]  css_offset   : u16 LE
///   [6..8]  css_len      : u16 LE
///   [8..10] tmpl_offset  : u16 LE
///   [10..12] tmpl_len    : u16 LE
///
/// String pool (starts at byte 4 + count * 12):
///   Concatenated UTF-8 bytes. Offsets relative to pool start.
/// ```
pub fn buildManifest(
    comptime count: u16,
    comptime names: [count][]const u8,
    comptime styles: [count][]const u8,
    comptime templates: [count][]const u8,
) *const [manifestSize(count, names, styles, templates)]u8 {
    comptime {
        assert(count > 0); // must have at least one component
        assert(count <= 256); // reasonable upper bound
    }

    const total = comptime manifestSize(count, names, styles, templates);
    const header_size: u32 = 4;
    const entry_size: u32 = 12;
    const entries_size: u32 = count * entry_size;

    const blob = comptime blk: {
        // copyInto loops over every byte in names, CSS, and templates.
        // `total` is the sum of all string lengths + header overhead, so
        // total * 10 gives enough headroom for the per-byte copy branches
        // plus the outer entry loop and writeU16LE calls.
        @setEvalBranchQuota(total * 10);
        var b: [total]u8 = .{0} ** total;

        // Header: component count (u16 LE)
        b[0] = @intCast(count & 0xFF);
        b[1] = @intCast((count >> 8) & 0xFF);
        // bytes 2..3 reserved = 0

        // Build entries and string pool
        var pool_offset: u32 = 0;
        for (0..count) |idx| {
            const entry_base = header_size + @as(u32, @intCast(idx)) * entry_size;
            const name = names[idx];
            const css = styles[idx];
            const tmpl = templates[idx];

            // name_offset, name_len
            writeU16LE(&b, entry_base + 0, @intCast(pool_offset));
            writeU16LE(&b, entry_base + 2, @intCast(name.len));
            copyInto(&b, header_size + entries_size + pool_offset, name);
            pool_offset += @intCast(name.len);

            // css_offset, css_len
            writeU16LE(&b, entry_base + 4, @intCast(pool_offset));
            writeU16LE(&b, entry_base + 6, @intCast(css.len));
            copyInto(&b, header_size + entries_size + pool_offset, css);
            pool_offset += @intCast(css.len);

            // tmpl_offset, tmpl_len
            writeU16LE(&b, entry_base + 8, @intCast(pool_offset));
            writeU16LE(&b, entry_base + 10, @intCast(tmpl.len));
            copyInto(&b, header_size + entries_size + pool_offset, tmpl);
            pool_offset += @intCast(tmpl.len);
        }

        break :blk b;
    };

    return &blob;
}

/// Compute the total manifest size in bytes for given component data.
fn manifestSize(
    comptime count: u16,
    comptime names: [count][]const u8,
    comptime styles: [count][]const u8,
    comptime templates: [count][]const u8,
) u32 {
    comptime {
        const header_size: u32 = 4;
        const entry_size: u32 = 12;
        const entries_size: u32 = count * entry_size;
        var pool_size: u32 = 0;
        for (0..count) |idx| {
            pool_size += @intCast(names[idx].len);
            pool_size += @intCast(styles[idx].len);
            pool_size += @intCast(templates[idx].len);
        }
        assert(pool_size <= 65535); // must fit in u16 offsets
        return header_size + entries_size + pool_size;
    }
}

/// Write a u16 little-endian value into a comptime byte array.
fn writeU16LE(comptime buf: []u8, comptime offset: u32, comptime val: u16) void {
    buf[offset] = @intCast(val & 0xFF);
    buf[offset + 1] = @intCast((val >> 8) & 0xFF);
}

/// Copy a string into a comptime byte array at the given offset.
fn copyInto(comptime buf: []u8, comptime offset: u32, comptime src: []const u8) void {
    @setEvalBranchQuota(src.len + 100);
    for (src, 0..) |byte, i| {
        buf[offset + i] = byte;
    }
}

/// Comptime component registry.
///
/// Takes a tuple of component types, validates them, and packs the binary manifest.
pub fn ComponentRegistry(comptime components: []const type) type {
    comptime {
        assert(components.len > 0); // must register at least one component
        assert(components.len <= 256); // reasonable upper bound
    }

    const count: u16 = @intCast(components.len);

    return struct {
        /// Number of registered components.
        pub const component_count: u16 = count;

        /// Raw CSS for each component, straight from the .css files.
        pub const raw_styles: [count][]const u8 = blk: {
            var s: [count][]const u8 = undefined;
            for (0..count) |i| {
                s[i] = components[i].style;
            }
            break :blk s;
        };

        /// Component names extracted from metadata.
        pub const names: [count][]const u8 = blk: {
            var n: [count][]const u8 = undefined;
            for (0..count) |i| {
                n[i] = components[i].metadata.name;
            }
            break :blk n;
        };

        /// Component templates extracted from declarations.
        pub const templates: [count][]const u8 = blk: {
            var t: [count][]const u8 = undefined;
            for (0..count) |i| {
                t[i] = components[i].template;
            }
            break :blk t;
        };

        /// Binary manifest blob — packed at comptime as a fixed-size array pointer.
        pub const manifest: []const u8 = buildManifest(count, names, raw_styles, templates);

        /// Validate all components and check for duplicate names.
        pub fn validate() void {
            comptime {
                for (0..count) |i| {
                    component.validateComponent(components[i]);
                }
                for (0..count) |i| {
                    for (i + 1..count) |j| {
                        if (eql(components[i].metadata.name, components[j].metadata.name)) {
                            @compileError("Duplicate component name: " ++ components[i].metadata.name);
                        }
                    }
                }
            }
        }
    };
}

/// Compute the tag ID for a component by name (11 + index).
///
/// Component tag IDs start at 11 in the TAG_TABLE (0 reserved, 1-9 HTML builtins,
/// 10 = slot). Returns the tag ID at comptime.
pub fn componentTagId(comptime components: []const type, comptime name: []const u8) u8 {
    for (components, 0..) |C, i| {
        if (eql(C.metadata.name, name)) {
            return @intCast(11 + i);
        }
    }
    @compileError("Unknown component name: " ++ name);
}

/// Comptime string equality check.
fn eql(comptime a: []const u8, comptime b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |ca, cb| {
        if (ca != cb) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "buildManifest: header encodes correct count" {
    const manifest = comptime buildManifest(
        1,
        .{"z-test"},
        .{"div { }"},
        .{"<div></div>"},
    );
    try std.testing.expectEqual(@as(u8, 1), manifest[0]);
    try std.testing.expectEqual(@as(u8, 0), manifest[1]);
    try std.testing.expectEqual(@as(u8, 0), manifest[2]);
    try std.testing.expectEqual(@as(u8, 0), manifest[3]);
}

test "buildManifest: string pool contains component name" {
    const manifest = comptime buildManifest(
        1,
        .{"z-test"},
        .{"div { }"},
        .{"<div></div>"},
    );
    const pool_start: u32 = 4 + 12;
    try std.testing.expectEqualSlices(u8, "z-test", manifest[pool_start .. pool_start + 6]);
}

const MockComponent = struct {
    pub const metadata = component.Metadata{ .name = "z-mock", .max_instances = 4 };
    pub const style = "div { color: red; }";
    pub const template = "<div></div>";
    pub const State = struct { nodes: [2]u16 = .{ 0, 0 }, dummy: u8 = 0 };
    pub fn render(_: *State, _: *component.CommandWriter, _: u16) void {}
    pub fn update(_: *State, _: *component.CommandWriter, _: anytype) void {}
    pub fn handleEvent(_: *State, _: *const event_ring_mod.EventRecord, _: anytype) void {}
    pub fn subscribe(_: *State) void {}
};

test "ComponentRegistry: single component validates and builds manifest" {
    const Reg = ComponentRegistry(&.{MockComponent});
    comptime Reg.validate();

    try std.testing.expectEqual(@as(u16, 1), Reg.component_count);
    try std.testing.expect(Reg.manifest.len > 0);
    try std.testing.expectEqualSlices(u8, "z-mock", Reg.names[0]);
}
