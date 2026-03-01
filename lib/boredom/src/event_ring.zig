//! Host-to-Zig event channel.
//!
//! Provides a fixed-size circular buffer for delivering DOM events from the JS
//! host into Zig application code. Events are pushed by the JS-side dispatch
//! function and drained each frame by `boredom_frame_tick`.
//!
//! No allocation occurs — the ring is a static, comptime-sized array.

const std = @import("std");
const assert = std.debug.assert;

/// A single DOM event record. Fixed 12-byte layout — no pointers, no allocation.
///
/// Event IDs use a compact u8 encoding; payload carries event-specific data
/// (e.g. mouse coordinates in future phases). Phase 2 only uses `click`.
pub const EventRecord = struct {
    /// The node that received the event.
    node_id: u16,
    /// Discriminator for the event type (see `EventId`).
    event_id: u8,
    /// Inline payload — avoids heap allocation for small event data.
    payload: [8]u8,
    /// How many bytes of `payload` are valid (0 for click).
    payload_len: u8,

    comptime {
        // EventRecord must be exactly 12 bytes — no padding, cache-friendly.
        assert(@sizeOf(EventRecord) == 12);
    }
};

/// Event type discriminators. Phase 2 only needs `click`.
pub const EventId = enum(u8) {
    click = 0x01,
    wheel = 0x02,
};

/// Fixed-size circular buffer for `EventRecord`s.
///
/// Overflow policy: when full, `push` drops the **oldest** entry (advances head)
/// so the newest events are always available. This prevents unbounded growth
/// while keeping the most recent user interactions.
pub fn RingBuffer(comptime capacity: u16) type {
    // capacity must be > 0 and a power of two for cheap modular arithmetic.
    comptime {
        assert(capacity > 0);
        assert(capacity & (capacity - 1) == 0); // power of two
    }

    return struct {
        const Self = @This();
        const mask: u16 = capacity - 1;

        items: [capacity]EventRecord = undefined,
        head: u16 = 0,
        tail: u16 = 0,
        count: u16 = 0,

        comptime {
            // Struct size: capacity * 12 bytes for items + 6 bytes for indices.
            // Must stay under 16 KB to be WASM-stack-friendly.
            assert(@sizeOf(Self) <= 16 * 1024);
        }

        /// Push an event into the ring. Returns `true` if successful,
        /// `false` if the oldest event was dropped to make room.
        pub fn push(self: *Self, record: EventRecord) bool {
            assert(self.head <= capacity); // head in bounds (wraps via mask)
            assert(self.tail <= capacity); // tail in bounds
            self.items[self.tail & mask] = record;
            self.tail = (self.tail +% 1) & mask;

            if (self.count == capacity) {
                // Overflow — drop oldest by advancing head.
                self.head = (self.head +% 1) & mask;
                assert(self.count == capacity); // count stays at max
                return false;
            }
            self.count += 1;
            assert(self.count <= capacity); // count never exceeds capacity
            return true;
        }

        /// Pop the oldest event. Returns `null` if empty.
        pub fn pop(self: *Self) ?EventRecord {
            assert(self.count <= capacity); // count invariant
            if (self.count == 0) {
                return null;
            }
            const record = self.items[self.head & mask];
            self.head = (self.head +% 1) & mask;
            self.count -= 1;
            assert(self.count < capacity); // count decreased
            return record;
        }

        /// Returns `true` when the ring has no pending events.
        pub fn isEmpty(self: *const Self) bool {
            assert(self.count <= capacity); // count invariant
            return self.count == 0;
        }

        /// Discard all pending events.
        pub fn reset(self: *Self) void {
            self.head = 0;
            self.tail = 0;
            self.count = 0;
            assert(self.isEmpty()); // must be empty after reset
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

fn makeEvent(node_id: u16, event_id: u8) EventRecord {
    return .{
        .node_id = node_id,
        .event_id = event_id,
        .payload = .{0} ** 8,
        .payload_len = 0,
    };
}

test "RingBuffer: push/pop FIFO order" {
    var ring: RingBuffer(4) = .{};

    _ = ring.push(makeEvent(1, 0x01));
    _ = ring.push(makeEvent(2, 0x01));
    _ = ring.push(makeEvent(3, 0x01));

    const a = ring.pop().?;
    const b = ring.pop().?;
    const c = ring.pop().?;
    try std.testing.expectEqual(@as(u16, 1), a.node_id);
    try std.testing.expectEqual(@as(u16, 2), b.node_id);
    try std.testing.expectEqual(@as(u16, 3), c.node_id);
    try std.testing.expect(ring.isEmpty());
}

test "RingBuffer: wrap-around" {
    var ring: RingBuffer(4) = .{};

    // Fill completely
    _ = ring.push(makeEvent(1, 0x01));
    _ = ring.push(makeEvent(2, 0x01));
    _ = ring.push(makeEvent(3, 0x01));
    _ = ring.push(makeEvent(4, 0x01));

    // Pop two
    _ = ring.pop();
    _ = ring.pop();

    // Push two more (wraps around)
    _ = ring.push(makeEvent(5, 0x01));
    _ = ring.push(makeEvent(6, 0x01));

    try std.testing.expectEqual(@as(u16, 3), ring.pop().?.node_id);
    try std.testing.expectEqual(@as(u16, 4), ring.pop().?.node_id);
    try std.testing.expectEqual(@as(u16, 5), ring.pop().?.node_id);
    try std.testing.expectEqual(@as(u16, 6), ring.pop().?.node_id);
    try std.testing.expect(ring.isEmpty());
}

test "RingBuffer: overflow drops oldest" {
    var ring: RingBuffer(4) = .{};

    _ = ring.push(makeEvent(1, 0x01));
    _ = ring.push(makeEvent(2, 0x01));
    _ = ring.push(makeEvent(3, 0x01));
    _ = ring.push(makeEvent(4, 0x01));

    // This should drop node_id=1 (oldest)
    const ok = ring.push(makeEvent(5, 0x01));
    try std.testing.expect(!ok); // overflow signaled

    try std.testing.expectEqual(@as(u16, 2), ring.pop().?.node_id);
    try std.testing.expectEqual(@as(u16, 3), ring.pop().?.node_id);
    try std.testing.expectEqual(@as(u16, 4), ring.pop().?.node_id);
    try std.testing.expectEqual(@as(u16, 5), ring.pop().?.node_id);
    try std.testing.expect(ring.isEmpty());
}

test "RingBuffer: empty pop returns null" {
    var ring: RingBuffer(4) = .{};
    try std.testing.expect(ring.pop() == null);
    try std.testing.expect(ring.isEmpty());
}

test "RingBuffer: reset clears all events" {
    var ring: RingBuffer(4) = .{};
    _ = ring.push(makeEvent(1, 0x01));
    _ = ring.push(makeEvent(2, 0x01));
    ring.reset();
    try std.testing.expect(ring.isEmpty());
    try std.testing.expect(ring.pop() == null);
}

test "EventRecord: size is exactly 12 bytes" {
    try std.testing.expectEqual(@as(usize, 12), @sizeOf(EventRecord));
}
