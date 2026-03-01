//! Auto-render from parsed HTML templates for boreDOM.
//!
//! Given a component type with a `template` declaration, parses the HTML at
//! comptime and generates render/subscribe logic automatically. Components
//! using template mode don't need to write `render()` or `subscribe()`.

const std = @import("std");
const assert = std.debug.assert;
const template_mod = @import("template.zig");
const command_mod = @import("command.zig");

/// Generate a template renderer for a component type.
///
/// The component must have `pub const template: []const u8` (embedded HTML).
/// Returns a struct with:
/// * `node_count` — number of element/slot nodes (not text nodes)
/// * `render(nodes, cmd, parent)` — emit the DOM tree
/// * `nodeIndex(bind_name)` — look up a node by its `data-bind` name
pub fn TemplateRenderer(comptime C: type) type {
    const parsed = comptime template_mod.parse(C.template);
    const elem_count = comptime countElements(parsed);

    return struct {
        /// Number of DOM nodes this template needs (elements + slots, not text).
        pub const node_count: u16 = elem_count;

        /// Emit the full DOM tree from the template.
        ///
        /// `nodes` is an array of pre-allocated node IDs (one per element/slot).
        /// `cmd` is the command writer. `parent` is the host element's node ID.
        pub fn render(nodes: []const u16, cmd: *command_mod.CommandWriter, parent: u16) void {
            comptime var elem_idx: u16 = 0;
            // Map from parsed node index → element index (for parent lookup)
            comptime var node_to_elem: [64]u16 = [_]u16{0xFFFF} ** 64;

            inline for (0..parsed.count) |ni| {
                const node = parsed.nodes[ni];
                switch (node.kind) {
                    .element, .slot => {
                        const my_elem_idx = elem_idx;
                        node_to_elem[ni] = my_elem_idx;
                        elem_idx += 1;

                        const tag_id = comptime template_mod.tagIdFromName(node.tag);
                        const parent_id: u16 = if (node.parent_index == 0xFF)
                            parent
                        else blk: {
                            const parent_elem = node_to_elem[node.parent_index];
                            break :blk if (parent_elem == 0xFFFF) parent else nodes[parent_elem];
                        };

                        cmd.createNode(
                            nodes[my_elem_idx],
                            tag_id,
                            parent_id,
                            command_mod.sentinel_node_id,
                        );

                        // Process attributes
                        inline for (node.attrs) |attr| {
                            if (comptime isEventAttr(attr.name)) {
                                const event_id = comptime template_mod.eventIdFromAttr(attr.name);
                                cmd.addListener(nodes[my_elem_idx], @enumFromInt(event_id));
                            }
                        }
                    },
                    .text => {
                        // Text nodes: setText on the parent element
                        if (node.parent_index != 0xFF) {
                            const parent_elem = node_to_elem[node.parent_index];
                            if (parent_elem != 0xFFFF) {
                                cmd.setText(nodes[parent_elem], node.text);
                            }
                        }
                    },
                }
            }
        }

        /// Look up the element index for a `data-bind="name"` attribute.
        ///
        /// Returns the index into the `nodes` array at comptime.
        pub fn nodeIndex(comptime bind_name: []const u8) u16 {
            comptime var elem_idx: u16 = 0;
            inline for (0..parsed.count) |ni| {
                const node = parsed.nodes[ni];
                switch (node.kind) {
                    .element, .slot => {
                        inline for (node.attrs) |attr| {
                            if (comptime eql(attr.name, "data-bind") and eql(attr.value, bind_name)) {
                                return elem_idx;
                            }
                        }
                        elem_idx += 1;
                    },
                    .text => {},
                }
            }
            @compileError("No element with data-bind=\"" ++ bind_name ++ "\" in template");
        }
    };
}

/// Count the number of element and slot nodes in a parsed template.
fn countElements(comptime parsed: anytype) u16 {
    var count: u16 = 0;
    for (0..parsed.count) |ni| {
        switch (parsed.nodes[ni].kind) {
            .element, .slot => count += 1,
            .text => {},
        }
    }
    return count;
}

fn eql(comptime a: []const u8, comptime b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |ca, cb| {
        if (ca != cb) return false;
    }
    return true;
}

fn isEventAttr(comptime name: []const u8) bool {
    return name.len > 8 and eql(name[0..8], "data-on-");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const MockTemplateComponent = struct {
    pub const template = "<div><button data-on-click>+1</button><span data-bind=\"count\">0</span></div>";
};

test "TemplateRenderer: node_count" {
    const R = TemplateRenderer(MockTemplateComponent);
    // div + button + span = 3 elements
    try std.testing.expectEqual(@as(u16, 3), R.node_count);
}

test "TemplateRenderer: nodeIndex for data-bind" {
    const R = TemplateRenderer(MockTemplateComponent);
    // "count" is on the span, which is element index 2 (div=0, button=1, span=2)
    try std.testing.expectEqual(@as(u16, 2), R.nodeIndex("count"));
}

test "TemplateRenderer: render emits commands" {
    const R = TemplateRenderer(MockTemplateComponent);
    var buf: [1024]u8 = @splat(0);
    var str: [256]u8 = undefined;
    var cmd: command_mod.CommandWriter = undefined;
    command_mod.CommandWriter.init(&cmd, &buf, &str);

    const nodes = [_]u16{ 10, 11, 12 };
    R.render(&nodes, &cmd, 5);

    // Should have emitted: 3 createNode + 1 setText("+1") + 1 setText("0") + 1 addListener = 6 commands
    try std.testing.expectEqual(@as(u32, 6), cmd.command_count);
}
