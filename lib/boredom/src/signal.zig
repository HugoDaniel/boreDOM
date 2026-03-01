//! Reactivity primitives for boreDOM.
//!
//! Provides `Signal` (a single reactive value with subscriber tracking) and
//! `DirtyQueue` (a bitset-backed queue of node IDs that need re-rendering).
//!
//! Signals are the core of boreDOM's change-detection: when a signal's value
//! changes, all subscribed node IDs are pushed into the dirty queue. The
//! frame loop then drains the queue and emits only the needed DOM updates.
//!
//! No allocation — all structures are comptime-sized.

const std = @import("std");
const assert = std.debug.assert;

/// Bitset-backed dirty queue for node IDs that need re-rendering.
///
/// Uses a fixed bitset so that duplicate pushes are idempotent — pushing the
/// same node ID twice results in only one entry in the drain sequence.
pub fn DirtyQueue(comptime max_nodes: u16) type {
    comptime {
        assert(max_nodes > 0); // must track at least one node
        assert(max_nodes <= 4096); // reasonable upper bound
        assert(max_nodes % 8 == 0); // must be byte-aligned for clean bitset
    }

    const byte_count = max_nodes / 8;

    return struct {
        const Self = @This();

        /// One bit per node ID. Bit N is set if node N is dirty.
        bits: [byte_count]u8 = .{0} ** byte_count,
        /// Number of dirty nodes (cached to avoid scanning the bitset).
        dirty_count: u16 = 0,

        comptime {
            // Must stay small — under 1 KB for Phase 2 (256 nodes = 32 bytes + 2).
            assert(@sizeOf(Self) <= 1024);
        }

        /// Mark a node ID as dirty. Idempotent — re-pushing is a no-op.
        pub fn push(self: *Self, node_id: u16) void {
            assert(node_id < max_nodes); // within tracked range
            const byte_idx = node_id / 8;
            const bit_idx: u3 = @intCast(node_id % 8);
            assert(byte_idx < byte_count); // byte index in bounds
            const mask = @as(u8, 1) << bit_idx;
            if (self.bits[byte_idx] & mask == 0) {
                self.bits[byte_idx] |= mask;
                self.dirty_count += 1;
            }
            assert(self.dirty_count <= max_nodes); // count invariant
        }

        /// Pop the next dirty node ID. Returns `null` if queue is empty.
        ///
        /// Scans the bitset linearly. Bounded to `byte_count` iterations.
        pub fn popNext(self: *Self) ?u16 {
            assert(self.dirty_count <= max_nodes); // count invariant
            if (self.dirty_count == 0) {
                return null;
            }
            var byte_idx: u16 = 0;
            while (byte_idx < byte_count) : (byte_idx += 1) {
                if (self.bits[byte_idx] != 0) {
                    const bit: u4 = @intCast(@ctz(self.bits[byte_idx]));
                    self.bits[byte_idx] &= ~(@as(u8, 1) << @as(u3, @intCast(bit)));
                    self.dirty_count -= 1;
                    const node_id = byte_idx * 8 + bit;
                    assert(node_id < max_nodes); // result within range
                    return node_id;
                }
            }
            // Should be unreachable if dirty_count > 0, but we assert anyway.
            assert(false); // dirty_count > 0 but no bits set — inconsistent state
            return null;
        }

        /// Returns `true` when no nodes are dirty.
        pub fn isEmpty(self: *const Self) bool {
            assert(self.dirty_count <= max_nodes); // count invariant
            return self.dirty_count == 0;
        }

        /// Clear all dirty flags.
        pub fn reset(self: *Self) void {
            @memset(&self.bits, 0);
            self.dirty_count = 0;
            assert(self.isEmpty()); // must be empty after reset
        }
    };
}

/// A single reactive value with subscriber tracking.
///
/// When the value changes via `set`, all subscribed node IDs are pushed into
/// the provided `DirtyQueue`. Subscribers are registered once and remain
/// until the signal is destroyed.
pub fn Signal(comptime T: type, comptime max_subscribers: u8) type {
    comptime {
        assert(max_subscribers > 0); // must support at least one subscriber
        assert(max_subscribers <= 32); // reasonable upper bound
        // T must be a simple value type that supports == comparison.
        assert(@sizeOf(T) <= 8); // keep signals small
    }

    return struct {
        const Self = @This();

        /// Current value.
        value: T,
        /// Node IDs that depend on this signal.
        subscribers: [max_subscribers]u16 = .{0} ** max_subscribers,
        /// How many subscribers are registered.
        subscriber_count: u8 = 0,

        /// Update the signal's value. If it changed, mark all subscribers dirty.
        ///
        /// `dirty_queue` receives the node IDs of all subscribers.
        pub fn set(self: *Self, new_value: T, dirty_queue: anytype) void {
            assert(self.subscriber_count <= max_subscribers); // count invariant
            if (self.value == new_value) {
                return; // no change — skip propagation
            }
            self.value = new_value;
            // Push all subscribers into the dirty queue.
            var i: u8 = 0;
            while (i < self.subscriber_count) : (i += 1) {
                assert(i < max_subscribers); // bounded loop
                dirty_queue.push(self.subscribers[i]);
            }
            assert(self.value == new_value); // value was updated
        }

        /// Register a node ID as a subscriber. Called once during setup.
        pub fn subscribe(self: *Self, node_id: u16) void {
            assert(self.subscriber_count < max_subscribers); // room for one more
            self.subscribers[self.subscriber_count] = node_id;
            self.subscriber_count += 1;
            assert(self.subscriber_count <= max_subscribers); // count invariant
        }

        /// Read the current value.
        pub fn get(self: *const Self) T {
            return self.value;
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "Signal: set and get" {
    var sig: Signal(u32, 4) = .{ .value = 0 };
    var dq: DirtyQueue(256) = .{};

    try std.testing.expectEqual(@as(u32, 0), sig.get());
    sig.set(42, &dq);
    try std.testing.expectEqual(@as(u32, 42), sig.get());
}

test "Signal: no-change set does not dirty subscribers" {
    var sig: Signal(u32, 4) = .{ .value = 10 };
    var dq: DirtyQueue(256) = .{};

    sig.subscribe(5);
    sig.set(10, &dq); // same value
    try std.testing.expect(dq.isEmpty()); // no dirty nodes
}

test "Signal: subscribe and dirty propagation" {
    var sig: Signal(u32, 4) = .{ .value = 0 };
    var dq: DirtyQueue(256) = .{};

    sig.subscribe(3);
    sig.subscribe(7);
    sig.set(1, &dq);

    try std.testing.expect(!dq.isEmpty());
    // Both subscribers should be in the dirty queue.
    const a = dq.popNext().?;
    const b = dq.popNext().?;
    // Order: node 3 pushed first (bit 3), node 7 pushed second (bit 7).
    // popNext scans low to high, so 3 comes first.
    try std.testing.expectEqual(@as(u16, 3), a);
    try std.testing.expectEqual(@as(u16, 7), b);
    try std.testing.expect(dq.isEmpty());
}

test "DirtyQueue: push is idempotent" {
    var dq: DirtyQueue(256) = .{};

    dq.push(5);
    dq.push(5); // duplicate
    dq.push(5); // duplicate again

    try std.testing.expectEqual(@as(u16, 1), dq.dirty_count);
    const id = dq.popNext().?;
    try std.testing.expectEqual(@as(u16, 5), id);
    try std.testing.expect(dq.isEmpty());
}

test "DirtyQueue: popNext returns null when empty" {
    var dq: DirtyQueue(256) = .{};
    try std.testing.expect(dq.popNext() == null);
}

test "DirtyQueue: reset clears all" {
    var dq: DirtyQueue(256) = .{};
    dq.push(1);
    dq.push(10);
    dq.push(100);
    dq.reset();
    try std.testing.expect(dq.isEmpty());
    try std.testing.expectEqual(@as(u16, 0), dq.dirty_count);
}

test "DirtyQueue: multiple pushes drain in order" {
    var dq: DirtyQueue(256) = .{};
    dq.push(10);
    dq.push(3);
    dq.push(7);

    // popNext scans low bits first, so order is 3, 7, 10
    try std.testing.expectEqual(@as(u16, 3), dq.popNext().?);
    try std.testing.expectEqual(@as(u16, 7), dq.popNext().?);
    try std.testing.expectEqual(@as(u16, 10), dq.popNext().?);
    try std.testing.expect(dq.isEmpty());
}
