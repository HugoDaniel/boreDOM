//! Comptime HTML parser for boreDOM.
//!
//! Parses embedded HTML templates at comptime into a flat array of `TemplateNode`s.
//! Supports: elements, text nodes, `<slot>`, attributes (`data-bind`, `data-on-click`,
//! `data-on-wheel`, `class`), and void tags (`<br>`, `<hr>`, `<input>`, `<img>`).
//! Whitespace-only text nodes are skipped. Comptime error on malformed input.

const std = @import("std");
const assert = std.debug.assert;

/// Kind of a parsed template node.
pub const NodeKind = enum(u8) {
    element,
    text,
    slot,
};

/// A single attribute on an element.
pub const Attribute = struct {
    name: []const u8,
    value: []const u8,
};

/// A single node in the parsed template tree.
pub const TemplateNode = struct {
    kind: NodeKind,
    /// Tag name for elements, empty for text.
    tag: []const u8 = "",
    /// Index of parent node in the array (0xFF = root).
    parent_index: u8 = 0xFF,
    /// Text content for text nodes.
    text: []const u8 = "",
    /// Attributes on this element.
    attrs: []const Attribute = &.{},
};

/// Result of parsing a template.
pub fn ParseResult(comptime max_nodes: u16) type {
    return struct {
        nodes: [max_nodes]TemplateNode = [_]TemplateNode{.{ .kind = .element }} ** max_nodes,
        count: u16 = 0,
    };
}

/// Known void elements that do not have closing tags.
const void_elements = [_][]const u8{
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
};

fn isVoidElement(comptime tag: []const u8) bool {
    for (void_elements) |ve| {
        if (eql(tag, ve)) return true;
    }
    return false;
}

fn eql(comptime a: []const u8, comptime b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |ca, cb| {
        if (ca != cb) return false;
    }
    return true;
}

fn isWhitespace(c: u8) bool {
    return c == ' ' or c == '\t' or c == '\n' or c == '\r';
}

fn isWhitespaceOnly(comptime s: []const u8) bool {
    for (s) |c| {
        if (!isWhitespace(c)) return false;
    }
    return true;
}

/// Parse an HTML template string at comptime.
///
/// Returns a ParseResult with up to 64 nodes. Comptime error on malformed input.
pub fn parse(comptime html: []const u8) ParseResult(64) {
    @setEvalBranchQuota(html.len * 100);
    var result: ParseResult(64) = .{};
    var pos: u32 = 0;
    // Stack of parent indices for nesting
    var parent_stack: [32]u8 = [_]u8{0xFF} ** 32;
    var stack_depth: u8 = 0;

    while (pos < html.len) {
        // Skip whitespace between tags
        if (html[pos] == '<') {
            // Check for HTML comment <!-- ... -->
            if (pos + 3 < html.len and html[pos + 1] == '!' and html[pos + 2] == '-' and html[pos + 3] == '-') {
                pos += 4; // skip "<!--"
                while (pos + 2 < html.len) : (pos += 1) {
                    if (html[pos] == '-' and html[pos + 1] == '-' and html[pos + 2] == '>') {
                        pos += 3; // skip "-->"
                        break;
                    }
                }
                continue;
            }

            // Check for closing tag
            if (pos + 1 < html.len and html[pos + 1] == '/') {
                // Closing tag — pop the stack
                pos += 2;
                // Skip to '>'
                while (pos < html.len and html[pos] != '>') : (pos += 1) {}
                if (pos < html.len) pos += 1; // skip '>'
                if (stack_depth > 0) stack_depth -= 1;
                continue;
            }

            // Opening tag
            pos += 1; // skip '<'
            const tag_start = pos;
            while (pos < html.len and html[pos] != '>' and html[pos] != ' ' and html[pos] != '/' and html[pos] != '\n' and html[pos] != '\t') : (pos += 1) {}
            const tag_name = html[tag_start..pos];

            if (tag_name.len == 0) @compileError("Empty tag name in template");

            // Parse attributes
            var attrs: [16]Attribute = undefined;
            var attr_count: u8 = 0;

            while (pos < html.len and html[pos] != '>' and html[pos] != '/') {
                // Skip whitespace
                while (pos < html.len and isWhitespace(html[pos])) : (pos += 1) {}
                if (pos >= html.len or html[pos] == '>' or html[pos] == '/') break;

                // Attribute name
                const attr_start = pos;
                while (pos < html.len and html[pos] != '=' and html[pos] != '>' and html[pos] != '/' and html[pos] != ' ' and html[pos] != '\n' and html[pos] != '\t') : (pos += 1) {}
                const attr_name = html[attr_start..pos];

                var attr_value: []const u8 = "";
                if (pos < html.len and html[pos] == '=') {
                    pos += 1; // skip '='
                    if (pos < html.len and html[pos] == '"') {
                        pos += 1; // skip opening quote
                        const val_start = pos;
                        while (pos < html.len and html[pos] != '"') : (pos += 1) {}
                        attr_value = html[val_start..pos];
                        if (pos < html.len) pos += 1; // skip closing quote
                    }
                }

                if (attr_name.len > 0 and attr_count < 16) {
                    attrs[attr_count] = .{ .name = attr_name, .value = attr_value };
                    attr_count += 1;
                }
            }

            // Handle self-closing or void elements
            var is_self_closing = false;
            if (pos < html.len and html[pos] == '/') {
                is_self_closing = true;
                pos += 1;
            }
            if (pos < html.len and html[pos] == '>') pos += 1;

            const is_void = comptime isVoidElement(tag_name);
            const kind: NodeKind = if (eql(tag_name, "slot")) .slot else .element;

            // Add node
            const node_idx = result.count;
            const parent_idx: u8 = if (stack_depth > 0) parent_stack[stack_depth - 1] else 0xFF;

            // Copy attrs to a comptime slice
            const final_attrs = blk: {
                var a: [attr_count]Attribute = undefined;
                for (0..attr_count) |ai| {
                    a[ai] = attrs[ai];
                }
                break :blk a;
            };

            result.nodes[node_idx] = .{
                .kind = kind,
                .tag = tag_name,
                .parent_index = parent_idx,
                .attrs = &final_attrs,
            };
            result.count += 1;

            // Push onto stack if not void/self-closing
            if (!is_void and !is_self_closing and kind != .slot) {
                parent_stack[stack_depth] = @intCast(node_idx);
                stack_depth += 1;
            }
        } else {
            // Text node — collect until '<'
            const text_start = pos;
            while (pos < html.len and html[pos] != '<') : (pos += 1) {}
            const text = html[text_start..pos];

            // Skip whitespace-only text nodes
            if (!isWhitespaceOnly(text)) {
                const trimmed = comptime trimText(text);
                const parent_idx: u8 = if (stack_depth > 0) parent_stack[stack_depth - 1] else 0xFF;
                result.nodes[result.count] = .{
                    .kind = .text,
                    .parent_index = parent_idx,
                    .text = trimmed,
                };
                result.count += 1;
            }
        }
    }

    return result;
}

/// Trim leading and trailing whitespace from text at comptime.
fn trimText(comptime s: []const u8) []const u8 {
    var start: u32 = 0;
    while (start < s.len and isWhitespace(s[start])) : (start += 1) {}
    var end: u32 = @intCast(s.len);
    while (end > start and isWhitespace(s[end - 1])) : (end -= 1) {}
    return s[start..end];
}

/// Map a tag name to its numeric tag ID (matching boredom.js TAG_TABLE).
pub fn tagIdFromName(comptime name: []const u8) u8 {
    const known = [_]struct { id: u8, tag: []const u8 }{
        .{ .id = 1, .tag = "div" },
        .{ .id = 2, .tag = "span" },
        .{ .id = 3, .tag = "button" },
        .{ .id = 4, .tag = "input" },
        .{ .id = 5, .tag = "h1" },
        .{ .id = 6, .tag = "h2" },
        .{ .id = 7, .tag = "p" },
        .{ .id = 8, .tag = "a" },
        .{ .id = 9, .tag = "code" },
        .{ .id = 10, .tag = "slot" },
    };
    for (known) |k| {
        if (eql(name, k.tag)) return k.id;
    }
    @compileError("Unknown tag name in template: " ++ name);
}

/// Map an event attribute name to its EventId value.
pub fn eventIdFromAttr(comptime attr: []const u8) u8 {
    if (eql(attr, "data-on-click")) return 0x01;
    if (eql(attr, "data-on-wheel")) return 0x02;
    @compileError("Unknown event attribute: " ++ attr);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "parse: simple div with button and span" {
    const result = comptime parse("<div><button>+1</button><span>0</span></div>");
    // div + button + text("+1") + span + text("0") = 5 nodes
    try std.testing.expectEqual(@as(u16, 5), result.count);
    // Node 0: div (root)
    try std.testing.expect(result.nodes[0].kind == .element);
    try std.testing.expect(eql(result.nodes[0].tag, "div"));
    try std.testing.expectEqual(@as(u8, 0xFF), result.nodes[0].parent_index);
    // Node 1: button (child of div)
    try std.testing.expect(result.nodes[1].kind == .element);
    try std.testing.expect(eql(result.nodes[1].tag, "button"));
    try std.testing.expectEqual(@as(u8, 0), result.nodes[1].parent_index);
    // Node 2: text "+1" (child of button)
    try std.testing.expect(result.nodes[2].kind == .text);
    try std.testing.expect(eql(result.nodes[2].text, "+1"));
    try std.testing.expectEqual(@as(u8, 1), result.nodes[2].parent_index);
    // Node 3: span (child of div)
    try std.testing.expect(result.nodes[3].kind == .element);
    try std.testing.expect(eql(result.nodes[3].tag, "span"));
    try std.testing.expectEqual(@as(u8, 0), result.nodes[3].parent_index);
    // Node 4: text "0" (child of span)
    try std.testing.expect(result.nodes[4].kind == .text);
    try std.testing.expect(eql(result.nodes[4].text, "0"));
    try std.testing.expectEqual(@as(u8, 3), result.nodes[4].parent_index);
}

test "parse: void elements" {
    const result = comptime parse("<div><br><input></div>");
    // div + br + input = 3 nodes
    try std.testing.expectEqual(@as(u16, 3), result.count);
    try std.testing.expect(eql(result.nodes[1].tag, "br"));
    try std.testing.expect(eql(result.nodes[2].tag, "input"));
}

test "parse: data-bind attribute" {
    const result = comptime parse("<span data-bind=\"count\">0</span>");
    try std.testing.expectEqual(@as(u16, 2), result.count);
    try std.testing.expect(result.nodes[0].attrs.len == 1);
    try std.testing.expect(eql(result.nodes[0].attrs[0].name, "data-bind"));
    try std.testing.expect(eql(result.nodes[0].attrs[0].value, "count"));
}

test "parse: data-on-click attribute" {
    const result = comptime parse("<button data-on-click>+1</button>");
    try std.testing.expectEqual(@as(u16, 2), result.count);
    try std.testing.expect(result.nodes[0].attrs.len == 1);
    try std.testing.expect(eql(result.nodes[0].attrs[0].name, "data-on-click"));
}

test "parse: whitespace-only text nodes skipped" {
    const result = comptime parse("<div>\n    <span>hello</span>\n</div>");
    // div + span + text "hello" = 3 nodes (whitespace skipped)
    try std.testing.expectEqual(@as(u16, 3), result.count);
}

test "tagIdFromName: known tags" {
    try std.testing.expectEqual(@as(u8, 1), comptime tagIdFromName("div"));
    try std.testing.expectEqual(@as(u8, 2), comptime tagIdFromName("span"));
    try std.testing.expectEqual(@as(u8, 3), comptime tagIdFromName("button"));
}

test "eventIdFromAttr: known events" {
    try std.testing.expectEqual(@as(u8, 0x01), comptime eventIdFromAttr("data-on-click"));
    try std.testing.expectEqual(@as(u8, 0x02), comptime eventIdFromAttr("data-on-wheel"));
}

test "parse: HTML comments are skipped" {
    const result = comptime parse("<div><!-- a comment --><span>hi</span></div>");
    // div + span + text "hi" = 3 nodes (comment skipped)
    try std.testing.expectEqual(@as(u16, 3), result.count);
    try std.testing.expect(eql(result.nodes[0].tag, "div"));
    try std.testing.expect(eql(result.nodes[1].tag, "span"));
    try std.testing.expect(eql(result.nodes[2].text, "hi"));
}
