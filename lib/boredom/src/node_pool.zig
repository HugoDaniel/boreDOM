//! Node ID allocator for boreDOM.
//!
//! Provides a fixed-size free-list allocator that hands out u16 node IDs.
//! IDs start at 1 (0 is reserved for document.body on the JS side).
//!
//! No dynamic allocation — the free list is a comptime-sized array.

const std = @import("std");
const assert = std.debug.assert;

/// Fixed-size free-list allocator for u16 node IDs.
///
/// Pre-fills the free list with IDs `1..max_nodes` at init.
/// ID 0 is reserved as the root (document.body).
pub fn NodePool(comptime max_nodes: u16) type {
    comptime {
        assert(max_nodes > 0); // must have at least one allocatable node
        assert(max_nodes <= 4096); // reasonable upper bound for Phase 2
    }

    return struct {
        const Self = @This();

        /// Stack-based free list. IDs are popped from the top.
        free_list: [max_nodes]u16 = undefined,
        /// Number of IDs available for allocation.
        free_count: u16 = 0,

        comptime {
            // Struct size: max_nodes * 2 bytes + 2 bytes for count.
            // Must stay under 16 KB for WASM stack friendliness.
            assert(@sizeOf(Self) <= 16 * 1024);
        }

        /// Initialize the pool by filling the free list with IDs 1..max_nodes.
        ///
        /// Must be called once before any `alloc` or `free` calls.
        pub fn init(self: *Self) void {
            var i: u16 = 0;
            while (i < max_nodes) : (i += 1) {
                // Fill in reverse so that alloc() returns IDs in ascending order.
                self.free_list[i] = max_nodes - i;
            }
            self.free_count = max_nodes;
            assert(self.free_count == max_nodes); // pool is fully stocked
            assert(self.free_list[max_nodes - 1] == 1); // lowest ID is at top
        }

        /// Allocate the next available node ID. Returns `null` if exhausted.
        pub fn alloc(self: *Self) ?u16 {
            assert(self.free_count <= max_nodes); // count invariant
            if (self.free_count == 0) {
                return null;
            }
            self.free_count -= 1;
            const id = self.free_list[self.free_count];
            assert(id >= 1); // ID 0 is reserved
            assert(id <= max_nodes); // within valid range
            return id;
        }

        /// Return a node ID to the pool for reuse.
        ///
        /// Caller must ensure the ID was previously allocated and is not
        /// returned twice without an intervening `alloc`.
        pub fn free(self: *Self, id: u16) void {
            assert(id >= 1); // ID 0 is reserved, cannot be freed
            assert(id <= max_nodes); // within valid range
            assert(self.free_count < max_nodes); // pool is not already full
            self.free_list[self.free_count] = id;
            self.free_count += 1;
            assert(self.free_count <= max_nodes); // count invariant
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "NodePool: alloc returns sequential IDs starting at 1" {
    var pool: NodePool(8) = .{};
    pool.init();

    const a = pool.alloc().?;
    const b = pool.alloc().?;
    const c = pool.alloc().?;
    try std.testing.expectEqual(@as(u16, 1), a);
    try std.testing.expectEqual(@as(u16, 2), b);
    try std.testing.expectEqual(@as(u16, 3), c);
}

test "NodePool: free then realloc returns freed ID" {
    var pool: NodePool(8) = .{};
    pool.init();

    const a = pool.alloc().?;
    try std.testing.expectEqual(@as(u16, 1), a);

    pool.free(a);
    const b = pool.alloc().?;
    try std.testing.expectEqual(@as(u16, 1), b); // recycled
}

test "NodePool: exhaustion returns null" {
    var pool: NodePool(4) = .{};
    pool.init();

    _ = pool.alloc();
    _ = pool.alloc();
    _ = pool.alloc();
    _ = pool.alloc();

    try std.testing.expect(pool.alloc() == null);
}

test "NodePool: free all then realloc" {
    var pool: NodePool(4) = .{};
    pool.init();

    const ids: [4]u16 = .{
        pool.alloc().?,
        pool.alloc().?,
        pool.alloc().?,
        pool.alloc().?,
    };

    // Free in reverse order
    var i: u8 = 4;
    while (i > 0) {
        i -= 1;
        pool.free(ids[i]);
    }

    // Should be able to allocate again
    const fresh = pool.alloc().?;
    try std.testing.expect(fresh >= 1);
    try std.testing.expect(fresh <= 4);
}
