//! Scroll tracker component for boreDOM — template mode.
//!
//! Displays two counters (X and Y) driven by wheel/trackpad deltas.
//! The HTML template defines the structure; `data-on-wheel` auto-wires
//! the wheel listener and `data-bind` names the updatable spans.

const std = @import("std");
const boredom = @import("boredom");

pub const metadata = boredom.Metadata{ .name = "z-scroll-tracker", .max_instances = 4 };

pub const style = @embedFile("scroll_tracker.css");
pub const template = @embedFile("scroll_tracker.html");

/// State holds only application data — no `nodes` array needed in template mode.
pub const State = struct {
    scroll_x: i32 = 0,
    scroll_y: i32 = 0,
    str_buf_x: [16]u8 = undefined,
    str_buf_y: [16]u8 = undefined,
};

/// Re-render dirty nodes. ctx.node() resolves data-bind names at comptime.
pub fn update(state: *State, cmd: *boredom.CommandWriter, ctx: anytype) void {
    const x_str = boredom.i32ToStr(state.scroll_x, &state.str_buf_x);
    cmd.setText(ctx.node("x-value"), x_str);

    const y_str = boredom.i32ToStr(state.scroll_y, &state.str_buf_y);
    cmd.setText(ctx.node("y-value"), y_str);
}

/// Handle wheel events — extract delta payload and update state.
pub fn handleEvent(state: *State, event: *const boredom.EventRecord, dirty_queue: anytype) void {
    if (event.event_id == @intFromEnum(boredom.EventId.wheel)) {
        std.debug.assert(event.payload_len == 8);

        const delta_x = std.mem.readInt(i32, event.payload[0..4], .little);
        const delta_y = std.mem.readInt(i32, event.payload[4..8], .little);

        state.scroll_x +%= delta_x;
        state.scroll_y +%= delta_y;

        dirty_queue.push(event.node_id);
    }
}
