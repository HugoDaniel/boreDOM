//! boreDOM framework root module.
//!
//! Single import for all framework types. Component authors and app.zig
//! only need `@import("boredom")`.

pub const component = @import("component.zig");
pub const app_framework = @import("app_framework.zig");
pub const signal = @import("signal.zig");
pub const event_ring = @import("event_ring.zig");
pub const command = @import("command.zig");
pub const node_pool = @import("node_pool.zig");
pub const registry = @import("registry.zig");
pub const template = @import("template.zig");
pub const template_render = @import("template_render.zig");

// Convenience re-exports for component authors
pub const Metadata = component.Metadata;
pub const CommandWriter = component.CommandWriter;
pub const Signal = signal.Signal;
pub const DirtyQueue = signal.DirtyQueue;
pub const EventId = command.EventId;
pub const EventRecord = event_ring.EventRecord;
pub const sentinel_node_id = command.sentinel_node_id;
pub const u32ToStr = component.u32ToStr;
pub const i32ToStr = component.i32ToStr;
pub const App = app_framework.App;
pub const NodeOwner = app_framework.NodeOwner;
pub const InstancePool = app_framework.InstancePool;
pub const TemplateRenderer = template_render.TemplateRenderer;
pub const componentTagId = registry.componentTagId;
