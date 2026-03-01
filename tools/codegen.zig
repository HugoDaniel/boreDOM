//! Tag table code generator for boreDOM.
//!
//! Generates `web/boredom_tables.js` containing the `TAG_TABLE` mapping from
//! Zig tag IDs (u8) to HTML element names. This keeps the JS runtime in sync
//! with the Zig-side tag constants without manual maintenance.
//!
//! Usage: `zig build run-codegen -- <output_file>`
//!
//! Invariants:
//! * Tag IDs start at 1 (0 is unused/invalid).
//! * The generated JS exports a plain object, not a Map.
//! * Output is deterministic — same input always produces identical output.

const std = @import("std");
const assert = std.debug.assert;

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const args = try std.process.argsAlloc(arena.allocator());
    assert(args.len >= 1); // argv[0] is always the program name
    if (args.len < 2) {
        std.debug.print("Usage: {s} <output_file>\n", .{args[0]});
        return error.MissingOutputFile;
    }

    const output_path = args[1];
    assert(output_path.len > 0); // path must be non-empty

    var file = try std.fs.cwd().createFile(output_path, .{});
    defer file.close();

    const writer = file.writer();
    // Phase 1 subset — expand as new element types are needed.
    // Tag IDs must match what Zig's createNode() uses.
    try writer.writeAll("export const TAG_TABLE = {\n");
    try writer.writeAll("    1: 'div',\n");
    try writer.writeAll("    2: 'span',\n");
    try writer.writeAll("    3: 'button',\n");
    try writer.writeAll("    4: 'input'\n");
    try writer.writeAll("};\n");
}
