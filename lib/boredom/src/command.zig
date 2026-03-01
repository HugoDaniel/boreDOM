//! Binary command buffer protocol for boreDOM.
//!
//! Encodes DOM mutations as a flat byte stream that the JS runtime interprets.
//! Two separate memory regions are used per frame:
//!
//! * **Command buffer** — opcodes, node IDs, and scalar payloads (little-endian).
//!   Bytes 0..3 hold the command count as u32 LE; bytes 4..7 are reserved.
//!   Commands begin at offset 8.
//!
//! * **String table** — raw UTF-8 payloads referenced by (offset, len) pairs
//!   embedded in command payloads.
//!
//! Invariants:
//! * Both regions are caller-owned, fixed-size slices — no allocation occurs.
//! * `offset` is always >= `header_len` (8) and <= `buffer.len`.
//! * `string_offset` is always <= `string_table.len`.
//! * `command_count` in the header always equals the number of `beginCommand` calls
//!   since the last `reset`.
//! * Node ID `0xFFFF` is reserved as the sentinel (FRAME_END, "append" for siblings).

const std = @import("std");
const assert = std.debug.assert;

/// Length of the fixed header at the start of the command buffer.
/// Bytes 0..3: command_count (u32 LE). Bytes 4..7: reserved.
const header_len: u32 = 8;

/// Size of the per-command framing: opcode (1) + node_id (2) + payload_len (2).
const command_frame_len: u32 = 5;

/// Reserved sentinel node ID — used by FRAME_END and as "append" for before_sibling.
pub const sentinel_node_id: u16 = 0xFFFF;

/// DOM event type discriminators. Wire-format constants (u8).
///
/// Phase 2 only uses `click`. Additional event types will be added in later phases.
pub const EventId = enum(u8) {
    click = 0x01,
    wheel = 0x02,
};

/// DOM mutation opcodes. Values are wire-format constants (u8).
///
/// Only `CREATE_NODE`, `SET_TEXT`, and `FRAME_END` are implemented in Phase 1.
/// The remaining opcodes are reserved for Phases 2+.
pub const OpCode = enum(u8) {
    create_node = 0x01,
    remove_node = 0x02,
    set_text = 0x03,
    set_attr = 0x04,
    remove_attr = 0x05,
    toggle_class = 0x06,
    add_listener = 0x07,
    remove_listener = 0x08,
    move_node = 0x09,
    list_begin = 0x0A,
    list_item = 0x0B,
    list_end = 0x0C,
    set_style_sheet = 0x0D,
    frame_end = 0x0E,
};

/// Zero-allocation binary serializer for the command buffer protocol.
///
/// Writes commands into a caller-owned `buffer` and string payloads into a
/// separate caller-owned `string_table`. Both slices must outlive the writer.
///
/// Thread safety: none — single-writer, single-frame at a time.
pub const CommandWriter = struct {
    buffer: []u8,
    offset: u32 = header_len,
    command_count: u32 = 0,

    string_table: []u8,
    string_offset: u32 = 0,

    // Compile-time layout verification: the struct must remain small enough
    // to be stack-friendly on native targets (two slices + three u32s).
    comptime {
        // Two slices (ptr+len each) = 4 words, three u32 fields = 12 bytes.
        // On wasm32 a word is 4 bytes: 4*4 + 12 = 28.
        // On 64-bit a word is 8 bytes: 4*8 + 12 = 44 (with padding up to 48).
        // Either way it must be <= 48 bytes.
        assert(@sizeOf(CommandWriter) <= 48);
    }

    /// Initialize a `CommandWriter` in place over the given buffers.
    ///
    /// `target.buffer.len` must be >= `header_len` (8) to hold the header.
    /// `target.string_table.len` must be > 0.
    pub fn init(target: *CommandWriter, buffer: []u8, string_table: []u8) void {
        assert(buffer.len >= header_len); // buffer must fit at least the header
        assert(string_table.len > 0); // string table must be usable
        target.* = .{
            .buffer = buffer,
            .string_table = string_table,
        };
        assert(target.offset == header_len); // default offset is past header
        assert(target.command_count == 0); // writer starts clean
    }

    /// Reset the writer for a new frame, preserving buffer references.
    ///
    /// After reset, `offset == header_len` and `command_count == 0`.
    pub fn reset(self: *CommandWriter) void {
        assert(self.buffer.len >= header_len); // buffer reference still valid
        self.offset = header_len;
        self.command_count = 0;
        self.string_offset = 0;
        assert(self.offset == header_len);
        assert(self.command_count == 0);
    }

    /// Copy `str` into the string table and return its byte offset.
    ///
    /// The returned offset is a u16 index into the string table region.
    /// Panics if the string is empty, exceeds u16 max length, or would
    /// overflow the string table.
    pub fn addString(self: *CommandWriter, str: []const u8) u16 {
        assert(str.len > 0); // empty strings must not enter the table
        assert(str.len <= std.math.maxInt(u16)); // length must fit in protocol u16
        assert(self.string_offset + str.len <= self.string_table.len); // table has room
        const start_offset = self.string_offset;
        @memcpy(self.string_table[start_offset .. start_offset + str.len], str);
        self.string_offset += @as(u32, @intCast(str.len));
        assert(self.string_offset > start_offset); // offset advanced
        assert(self.string_offset <= self.string_table.len); // still within bounds
        return @as(u16, @intCast(start_offset));
    }

    /// Write a u16 little-endian value at the current offset and advance by 2.
    fn write16(self: *CommandWriter, val: u16) void {
        assert(self.offset + 2 <= self.buffer.len); // room for 2 bytes
        std.mem.writeInt(u16, self.buffer[self.offset .. self.offset + 2][0..2], val, .little);
        self.offset += 2;
        assert(self.offset <= self.buffer.len); // still in bounds
    }

    /// Write the 5-byte command header: [opcode u8][node_id u16 LE][payload_len u16 LE].
    ///
    /// Also increments `command_count` and writes the updated count into the
    /// buffer header (bytes 0..3).
    pub fn beginCommand(self: *CommandWriter, op: OpCode, node_id: u16, payload_len: u16) void {
        assert(self.offset + command_frame_len + payload_len <= self.buffer.len); // room for header + payload
        const offset_before = self.offset;
        self.buffer[self.offset] = @intFromEnum(op);
        self.offset += 1;
        self.write16(node_id);
        self.write16(payload_len);
        self.command_count += 1;
        std.mem.writeInt(u32, self.buffer[0..4][0..4], self.command_count, .little);
        assert(self.offset == offset_before + command_frame_len); // advanced by exactly 5
        assert(self.command_count >= 1); // at least one command written
    }

    /// Emit a CREATE_NODE command.
    ///
    /// Payload (5 bytes): [tag_id u8][parent_id u16 LE][before_sibling u16 LE].
    /// Use `sentinel_node_id` (0xFFFF) for `before_sibling` to append.
    pub fn createNode(self: *CommandWriter, node_id: u16, tag_id: u8, parent_id: u16, before_sibling: u16) void {
        assert(node_id != sentinel_node_id); // sentinel is reserved, cannot be a real node
        assert(tag_id > 0); // tag ID 0 is unused
        self.beginCommand(.create_node, node_id, 5);
        self.buffer[self.offset] = tag_id;
        self.offset += 1;
        self.write16(parent_id);
        self.write16(before_sibling);
        assert(self.command_count >= 1); // command was written
    }

    /// Emit a SET_TEXT command.
    ///
    /// Payload (4 bytes): [str_offset u16 LE][str_len u16 LE].
    /// The text is copied into the string table via `addString`.
    pub fn setText(self: *CommandWriter, node_id: u16, text: []const u8) void {
        assert(node_id != sentinel_node_id); // sentinel cannot receive text
        assert(text.len > 0); // use REMOVE_NODE or empty-string opcode instead
        const str_offset = self.addString(text);
        self.beginCommand(.set_text, node_id, 4);
        self.write16(str_offset);
        self.write16(@as(u16, @intCast(text.len)));
        assert(self.command_count >= 1); // command was written
    }

    /// Emit an ADD_LISTENER command.
    ///
    /// Payload (1 byte): [event_id u8].
    /// Tells the JS runtime to attach a DOM event listener on the given node.
    pub fn addListener(self: *CommandWriter, node_id: u16, event_id: EventId) void {
        assert(node_id != sentinel_node_id); // sentinel cannot receive listeners
        assert(@intFromEnum(event_id) > 0); // event ID 0 is reserved
        self.beginCommand(.add_listener, node_id, 1);
        self.buffer[self.offset] = @intFromEnum(event_id);
        self.offset += 1;
        assert(self.command_count >= 1); // command was written
    }

    /// Emit a TOGGLE_CLASS command.
    ///
    /// Payload (5 bytes): [str_offset u16 LE][str_len u16 LE][action u8].
    /// Action: 1 = add class, 0 = remove class.
    /// The class name is copied into the string table via `addString`.
    pub fn toggleClass(self: *CommandWriter, node_id: u16, class_name: []const u8, add: bool) void {
        assert(node_id != sentinel_node_id); // sentinel cannot have classes
        assert(class_name.len > 0); // class name must be non-empty
        const str_offset = self.addString(class_name);
        self.beginCommand(.toggle_class, node_id, 5);
        self.write16(str_offset);
        self.write16(@as(u16, @intCast(class_name.len)));
        self.buffer[self.offset] = if (add) 1 else 0;
        self.offset += 1;
        assert(self.command_count >= 1); // command was written
    }

    /// Emit a REMOVE_NODE command.
    ///
    /// Tells the JS runtime to remove the node from the DOM and clean up.
    /// Zero-byte payload.
    pub fn removeNode(self: *CommandWriter, node_id: u16) void {
        assert(node_id != sentinel_node_id);
        self.beginCommand(.remove_node, node_id, 0);
    }

    /// Emit a FRAME_END marker. Signals the JS runtime to stop reading.
    ///
    /// Uses `sentinel_node_id` as the node_id. Zero-byte payload.
    pub fn frameEnd(self: *CommandWriter) void {
        const count_before = self.command_count;
        self.beginCommand(.frame_end, sentinel_node_id, 0);
        assert(self.command_count == count_before + 1); // exactly one command added
        assert(self.command_count >= 1); // at least FRAME_END present
    }

    /// Return the number of valid bytes in the command buffer (header + commands).
    ///
    /// Always >= `header_len` (8), since the header is always present.
    pub fn commandBytes(self: *const CommandWriter) u32 {
        assert(self.offset >= header_len); // header always present
        assert(self.offset <= self.buffer.len); // within buffer bounds
        return self.offset;
    }

    /// Return the number of valid bytes in the string table.
    ///
    /// Zero if no strings were written this frame.
    pub fn stringBytes(self: *const CommandWriter) u32 {
        assert(self.string_offset <= self.string_table.len); // within table bounds
        return self.string_offset;
    }
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "CommandWriter: init sets correct defaults" {
    var buf: [256]u8 = undefined;
    var str: [64]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    try std.testing.expectEqual(@as(u32, header_len), w.offset);
    try std.testing.expectEqual(@as(u32, 0), w.command_count);
    try std.testing.expectEqual(@as(u32, 0), w.string_offset);
}

test "CommandWriter: reset restores clean state" {
    var buf: [256]u8 = undefined;
    var str: [64]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    // dirty the writer
    w.createNode(1, 1, 0, sentinel_node_id);
    w.setText(1, "hello");
    try std.testing.expect(w.offset > header_len);
    try std.testing.expect(w.command_count > 0);
    try std.testing.expect(w.string_offset > 0);

    w.reset();
    try std.testing.expectEqual(@as(u32, header_len), w.offset);
    try std.testing.expectEqual(@as(u32, 0), w.command_count);
    try std.testing.expectEqual(@as(u32, 0), w.string_offset);
}

test "CommandWriter: createNode encodes correct wire format" {
    var buf: [256]u8 = @splat(0);
    var str: [64]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    w.createNode(42, 1, 0, sentinel_node_id);

    // Header: command_count = 1 at offset 0
    const count = std.mem.readInt(u32, buf[0..4], .little);
    try std.testing.expectEqual(@as(u32, 1), count);

    // Command at offset 8: opcode
    try std.testing.expectEqual(@as(u8, 0x01), buf[header_len]);
    // node_id = 42
    const node_id = std.mem.readInt(u16, buf[header_len + 1 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 42), node_id);
    // payload_len = 5
    const payload_len = std.mem.readInt(u16, buf[header_len + 3 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 5), payload_len);
    // payload: tag_id = 1
    try std.testing.expectEqual(@as(u8, 1), buf[header_len + 5]);
    // parent_id = 0
    const parent_id = std.mem.readInt(u16, buf[header_len + 6 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 0), parent_id);
    // before_sibling = 0xFFFF
    const before_sib = std.mem.readInt(u16, buf[header_len + 8 ..][0..2], .little);
    try std.testing.expectEqual(sentinel_node_id, before_sib);
}

test "CommandWriter: setText encodes string table reference" {
    var buf: [256]u8 = @splat(0);
    var str: [64]u8 = @splat(0);
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    w.setText(7, "Hello");

    // String table should contain "Hello" at offset 0
    try std.testing.expectEqualSlices(u8, "Hello", str[0..5]);
    try std.testing.expectEqual(@as(u32, 5), w.string_offset);

    // Command: opcode = SET_TEXT (0x03), node_id = 7, payload_len = 4
    try std.testing.expectEqual(@as(u8, 0x03), buf[header_len]);
    const node_id = std.mem.readInt(u16, buf[header_len + 1 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 7), node_id);
    // payload: str_offset = 0, str_len = 5
    const str_off = std.mem.readInt(u16, buf[header_len + 5 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 0), str_off);
    const str_len = std.mem.readInt(u16, buf[header_len + 7 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 5), str_len);
}

test "CommandWriter: multiple commands produce correct count and offsets" {
    var buf: [512]u8 = @splat(0);
    var str: [128]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    w.createNode(1, 1, 0, sentinel_node_id); // 5-byte frame + 5-byte payload = 10
    w.createNode(2, 2, 0, sentinel_node_id); // another 10
    w.setText(1, "abc"); // 5-byte frame + 4-byte payload = 9
    w.frameEnd(); // 5-byte frame + 0-byte payload = 5

    try std.testing.expectEqual(@as(u32, 4), w.command_count);
    // offset = 8 (header) + 10 + 10 + 9 + 5 = 42
    try std.testing.expectEqual(@as(u32, 42), w.offset);
    try std.testing.expectEqual(@as(u32, 42), w.commandBytes());
    try std.testing.expectEqual(@as(u32, 3), w.stringBytes()); // "abc" = 3 bytes
}

test "CommandWriter: frameEnd uses sentinel node_id" {
    var buf: [64]u8 = @splat(0);
    var str: [16]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    w.frameEnd();

    // opcode = FRAME_END (0x0E)
    try std.testing.expectEqual(@as(u8, 0x0E), buf[header_len]);
    // node_id = 0xFFFF
    const node_id = std.mem.readInt(u16, buf[header_len + 1 ..][0..2], .little);
    try std.testing.expectEqual(sentinel_node_id, node_id);
    // payload_len = 0
    const payload_len = std.mem.readInt(u16, buf[header_len + 3 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 0), payload_len);
}

test "CommandWriter: addString returns correct sequential offsets" {
    var buf: [64]u8 = undefined;
    var str: [128]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    const off1 = w.addString("Hello");
    const off2 = w.addString(" world");
    try std.testing.expectEqual(@as(u16, 0), off1);
    try std.testing.expectEqual(@as(u16, 5), off2);
    try std.testing.expectEqualSlices(u8, "Hello world", str[0..11]);
}

test "CommandWriter: commandBytes and stringBytes on empty frame" {
    var buf: [64]u8 = undefined;
    var str: [16]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    try std.testing.expectEqual(@as(u32, header_len), w.commandBytes());
    try std.testing.expectEqual(@as(u32, 0), w.stringBytes());
}

test "CommandWriter: addListener encodes correct wire format" {
    var buf: [256]u8 = @splat(0);
    var str: [64]u8 = undefined;
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    w.addListener(5, .click);

    // Header: command_count = 1
    const count = std.mem.readInt(u32, buf[0..4], .little);
    try std.testing.expectEqual(@as(u32, 1), count);

    // Command at offset 8: opcode = ADD_LISTENER (0x07)
    try std.testing.expectEqual(@as(u8, 0x07), buf[header_len]);
    // node_id = 5
    const node_id = std.mem.readInt(u16, buf[header_len + 1 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 5), node_id);
    // payload_len = 1
    const payload_len = std.mem.readInt(u16, buf[header_len + 3 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 1), payload_len);
    // payload: event_id = 0x01 (click)
    try std.testing.expectEqual(@as(u8, 0x01), buf[header_len + 5]);
}

test "CommandWriter: toggleClass encodes correct wire format" {
    var buf: [256]u8 = @splat(0);
    var str: [64]u8 = @splat(0);
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    w.toggleClass(10, "z0", true);

    // Header: command_count = 1
    const count = std.mem.readInt(u32, buf[0..4], .little);
    try std.testing.expectEqual(@as(u32, 1), count);

    // Command at offset 8: opcode = TOGGLE_CLASS (0x06)
    try std.testing.expectEqual(@as(u8, 0x06), buf[header_len]);
    // node_id = 10
    const node_id = std.mem.readInt(u16, buf[header_len + 1 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 10), node_id);
    // payload_len = 5
    const payload_len = std.mem.readInt(u16, buf[header_len + 3 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 5), payload_len);
    // payload: str_offset = 0
    const str_off = std.mem.readInt(u16, buf[header_len + 5 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 0), str_off);
    // str_len = 2
    const str_len = std.mem.readInt(u16, buf[header_len + 7 ..][0..2], .little);
    try std.testing.expectEqual(@as(u16, 2), str_len);
    // action = 1 (add)
    try std.testing.expectEqual(@as(u8, 1), buf[header_len + 9]);
    // String table contains "z0"
    try std.testing.expectEqualSlices(u8, "z0", str[0..2]);
}

test "CommandWriter: toggleClass remove encodes action 0" {
    var buf: [256]u8 = @splat(0);
    var str: [64]u8 = @splat(0);
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    w.toggleClass(5, "active", false);

    // action byte should be 0 (remove)
    try std.testing.expectEqual(@as(u8, 0), buf[header_len + 9]);
}

test "CommandWriter: reset then reuse produces independent frames" {
    var buf: [256]u8 = @splat(0);
    var str: [64]u8 = @splat(0);
    var w: CommandWriter = undefined;
    CommandWriter.init(&w, &buf, &str);

    // Frame 1
    w.createNode(1, 1, 0, sentinel_node_id);
    w.setText(1, "frame1");
    w.frameEnd();
    const frame1_cmd_bytes = w.commandBytes();
    const frame1_str_bytes = w.stringBytes();

    // Frame 2 after reset
    w.reset();
    w.createNode(2, 2, 0, sentinel_node_id);
    w.frameEnd();

    // Frame 2 should be smaller — fewer commands, no strings
    try std.testing.expect(w.commandBytes() < frame1_cmd_bytes);
    try std.testing.expectEqual(@as(u32, 0), w.stringBytes());
    _ = frame1_str_bytes;

    // command_count in header should be 2 (createNode + frameEnd)
    const count = std.mem.readInt(u32, buf[0..4], .little);
    try std.testing.expectEqual(@as(u32, 2), count);
}
