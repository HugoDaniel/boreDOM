//! Counter component for boreDOM — template mode.
//!
//! The HTML template is the source of truth for the DOM structure.
//! `data-on-click` in the template auto-wires a click listener.
//! `data-bind="count"` names a node so update() can reference it via ctx.node("count").
//!
//! No render() or subscribe() needed — the framework handles both at comptime.

const boredom = @import("boredom");

pub const metadata = boredom.Metadata{ .name = "z-counter", .max_instances = 8 };

pub const style = @embedFile("counter.css");
pub const template = @embedFile("counter.html");

/// State holds only application data — no `nodes` array needed in template mode.
pub const State = struct {
    count: u32 = 0,
    str_buf: [16]u8 = undefined,
};

/// Called when a dirty node triggers a re-render.
/// `ctx.node("count")` resolves the data-bind name to a node ID at comptime.
pub fn update(state: *State, cmd: *boredom.CommandWriter, ctx: anytype) void {
    const count_str = boredom.u32ToStr(state.count, &state.str_buf);
    cmd.setText(ctx.node("count"), count_str);
}

/// Route DOM events to state changes.
/// Push the event's node_id to the dirty queue so update() gets called next frame.
pub fn handleEvent(state: *State, event: *const boredom.EventRecord, dirty_queue: anytype) void {
    if (event.event_id == @intFromEnum(boredom.EventId.click)) {
        state.count +%= 1;
        dirty_queue.push(event.node_id);
    }
}
