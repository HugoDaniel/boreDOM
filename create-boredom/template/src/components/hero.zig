//! Hero component for boreDOM — template mode.
//!
//! Purely static: the HTML template is the source of truth.
//! No render() or subscribe() needed — the framework auto-generates them
//! from the template at comptime.

const boredom = @import("boredom");

pub const metadata = boredom.Metadata{ .name = "z-hero", .max_instances = 4 };

pub const style = @embedFile("hero.css");
pub const template = @embedFile("hero.html");

/// State only needs fields the component actually uses.
/// No `nodes` array needed — the framework injects one from the parsed template.
pub const State = struct {
    _pad: u8 = 0, // State must be non-zero-sized
};

pub fn update(_: *State, _: *boredom.CommandWriter, _: anytype) void {}

pub fn handleEvent(_: *State, _: *const boredom.EventRecord, _: anytype) void {}
