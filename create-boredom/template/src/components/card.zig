//! Card component for boreDOM — template mode.
//!
//! The HTML template defines the DOM structure.
//! `data-on-click` auto-wires the button's click listener.
//! `data-bind="label"` lets update() change the button text dynamically.

const boredom = @import("boredom");

pub const metadata = boredom.Metadata{ .name = "z-card", .max_instances = 8 };

pub const style = @embedFile("card.css");
pub const template = @embedFile("card.html");

pub const State = struct {
    clicks: u32 = 0,
    str_buf: [32]u8 = undefined,
};

pub fn update(state: *State, cmd: *boredom.CommandWriter, ctx: anytype) void {
    const label = buttonLabel(state.clicks, &state.str_buf);
    cmd.setText(ctx.node("label"), label);
}

pub fn handleEvent(state: *State, event: *const boredom.EventRecord, dirty_queue: anytype) void {
    if (event.event_id == @intFromEnum(boredom.EventId.click)) {
        state.clicks +%= 1;
        dirty_queue.push(event.node_id);
    }
}

fn buttonLabel(count: u32, buf: *[32]u8) []const u8 {
    if (count == 0) return "Click me";
    const count_str = boredom.u32ToStr(count, buf[0..16]);
    const prefix = "Clicked ";
    const suffix = if (count == 1) " time" else " times";
    var out: usize = 0;
    @memcpy(buf[out..][0..prefix.len], prefix);
    out += prefix.len;
    @memcpy(buf[out..][0..count_str.len], count_str);
    out += count_str.len;
    @memcpy(buf[out..][0..suffix.len], suffix);
    out += suffix.len;
    return buf[0..out];
}
