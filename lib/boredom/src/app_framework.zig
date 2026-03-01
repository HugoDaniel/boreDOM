//! Comptime application framework for boreDOM.
//!
//! Generates a fully-wired application struct from a tuple of component types.
//! Supports multi-instance components via pre-allocated instance pools, O(1)
//! event routing via a node ownership table, and on-demand instance creation
//! driven by the JS Web Component lifecycle.

const std = @import("std");
const assert = std.debug.assert;
const component = @import("component.zig");
const registry_mod = @import("registry.zig");
const node_pool_mod = @import("node_pool.zig");
const event_ring_mod = @import("event_ring.zig");
const signal_mod = @import("signal.zig");
const template_render_mod = @import("template_render.zig");

/// Node ownership record — maps a node ID to its owning component instance.
pub const NodeOwner = packed struct {
    type_id: u8 = 0xFF,
    instance_id: u8 = 0xFF,

    pub fn isUnowned(self: NodeOwner) bool {
        return self.type_id == 0xFF;
    }
};

/// Compute the total number of node slots a component needs.
/// Imperative mode: from State.nodes array. Template mode: from parsed template.
fn nodeSlotCount(comptime C: type) u16 {
    if (component.isImperativeMode(C)) {
        return component.tagSlotsFromState(C);
    } else {
        // Template mode — count from parsed template
        const R = template_render_mod.TemplateRenderer(C);
        return R.node_count;
    }
}

/// Pre-allocated instance pool for a single component type.
pub fn InstancePool(comptime C: type) type {
    const max = C.metadata.max_instances;
    const slots = comptime nodeSlotCount(C);
    const has_nodes = slots > 0;

    return struct {
        const Self = @This();

        pub const node_slots = slots;

        states: [max]C.State = [_]C.State{.{}} ** max,
        active: [max]bool = [_]bool{false} ** max,
        pending_render: [max]bool = [_]bool{false} ** max,
        host_node: [max]u16 = [_]u16{0xFFFF} ** max,
        /// Per-instance node ID arrays.
        instance_nodes: if (has_nodes) [max][slots]u16 else void =
            if (has_nodes) [_][slots]u16{[_]u16{0xFFFF} ** slots} ** max else {},
        instance_count: u16 = 0,

        /// Claim a pool slot for a new instance. Returns the instance ID or null if full.
        pub fn claim(self: *Self, host: u16) ?u16 {
            var i: u16 = 0;
            while (i < max) : (i += 1) {
                if (!self.active[i]) {
                    self.active[i] = true;
                    self.pending_render[i] = true;
                    self.host_node[i] = host;
                    self.states[i] = .{};
                    self.instance_count += 1;
                    return i;
                }
            }
            return null; // pool exhausted
        }

        /// Release a pool slot, freeing the instance.
        pub fn release(self: *Self, id: u16) void {
            assert(id < max);
            assert(self.active[id]);
            self.active[id] = false;
            self.pending_render[id] = false;
            self.host_node[id] = 0xFFFF;
            self.instance_count -= 1;
        }
    };
}

/// Generate a wired application struct from a list of component types.
pub fn App(comptime components: []const type, comptime max_nodes: u16) type {
    comptime {
        assert(components.len > 0);
        assert(components.len <= 256);
        assert(max_nodes > 0);
        assert(max_nodes <= 4096);
    }

    // Validate all components at comptime.
    comptime {
        for (components) |C| {
            component.validateComponent(C);
        }
    }

    // Build the heterogeneous pool storage type.
    const PoolTypes = blk: {
        var types: [components.len]type = undefined;
        for (components, 0..) |C, i| {
            types[i] = InstancePool(C);
        }
        break :blk types;
    };
    const PoolStorageType = std.meta.Tuple(&PoolTypes);

    const Registry = registry_mod.ComponentRegistry(components);
    comptime {
        Registry.validate();
    }

    return struct {
        /// Instance pools — one pool per component type.
        var pools: PoolStorageType = init_blk: {
            var v: PoolStorageType = undefined;
            for (0..components.len) |i| {
                v[i] = .{};
            }
            break :init_blk v;
        };

        /// Node ownership table — maps node ID → (type_id, instance_id).
        var node_owners: [max_nodes]NodeOwner = [_]NodeOwner{.{}} ** max_nodes;

        /// Initialize the framework. No longer pre-allocates nodes or renders —
        /// instances are created on demand via createInstance.
        pub fn init(pool: *node_pool_mod.NodePool(max_nodes)) void {
            _ = pool;
            // Reset all pools
            inline for (0..components.len) |i| {
                pools[i] = .{};
            }
            // Clear ownership table
            @memset(&node_owners, .{});
        }

        /// Create a new instance of a component type.
        ///
        /// Allocates a pool slot, assigns node IDs from the global pool, sets
        /// ownership, and marks the instance for pending render.
        /// Returns the instance ID, or 0xFFFF if pool is exhausted.
        pub fn createInstance(type_id: u16, host_node_id: u16, pool: *node_pool_mod.NodePool(max_nodes)) u16 {
            assert(type_id < components.len);
            assert(host_node_id < max_nodes);

            var result: u16 = 0xFFFF;
            inline for (0..components.len) |i| {
                if (type_id == i) {
                    const instance_id = pools[i].claim(host_node_id) orelse return 0xFFFF;
                    result = instance_id;

                    // Set host node ownership
                    node_owners[host_node_id] = .{
                        .type_id = @intCast(i),
                        .instance_id = @intCast(instance_id),
                    };

                    // Allocate node IDs for this instance
                    const slots = comptime nodeSlotCount(components[i]);
                    if (slots > 0) {
                        var slot: u16 = 0;
                        while (slot < slots) : (slot += 1) {
                            const node_id = pool.alloc() orelse unreachable;
                            pools[i].instance_nodes[instance_id][slot] = node_id;
                            node_owners[node_id] = .{
                                .type_id = @intCast(i),
                                .instance_id = @intCast(instance_id),
                            };
                        }

                        // For imperative mode, copy node IDs into State.nodes
                        if (component.isImperativeMode(components[i])) {
                            const state_slots = component.tagSlotsFromState(components[i]);
                            if (state_slots > 0) {
                                var s: u16 = 0;
                                while (s < state_slots) : (s += 1) {
                                    pools[i].states[instance_id].nodes[s] = pools[i].instance_nodes[instance_id][s];
                                }
                            }
                            components[i].subscribe(&pools[i].states[instance_id]);
                        }
                    }
                }
            }
            return result;
        }

        /// Destroy an instance, freeing its pool slot and node IDs.
        pub fn destroyInstance(type_id: u16, instance_id: u16, pool: *node_pool_mod.NodePool(max_nodes), cmd: *component.CommandWriter) void {
            assert(type_id < components.len);

            inline for (0..components.len) |i| {
                if (type_id == i) {
                    assert(instance_id < components[i].metadata.max_instances);
                    assert(pools[i].active[instance_id]);

                    // Free component node IDs and clear ownership
                    const slots = comptime nodeSlotCount(components[i]);
                    if (slots > 0) {
                        var slot: u16 = 0;
                        while (slot < slots) : (slot += 1) {
                            const node_id = pools[i].instance_nodes[instance_id][slot];
                            if (node_id != 0xFFFF) {
                                cmd.removeNode(node_id);
                                node_owners[node_id] = .{};
                                pool.free(node_id);
                            }
                        }
                        pools[i].instance_nodes[instance_id] = [_]u16{0xFFFF} ** slots;
                    }

                    // Clear host node ownership
                    const host = pools[i].host_node[instance_id];
                    if (host != 0xFFFF and host < max_nodes) {
                        node_owners[host] = .{};
                    }

                    pools[i].release(instance_id);
                }
            }
        }

        /// Render all pending instances (newly created since last frame).
        pub fn renderPending(cmd: *component.CommandWriter) void {
            inline for (0..components.len) |i| {
                const pool_ptr = &pools[i];
                var inst: u16 = 0;
                while (inst < components[i].metadata.max_instances) : (inst += 1) {
                    if (pool_ptr.pending_render[inst]) {
                        pool_ptr.pending_render[inst] = false;
                        const parent = pool_ptr.host_node[inst];
                        if (component.isImperativeMode(components[i])) {
                            components[i].render(&pool_ptr.states[inst], cmd, parent);
                        } else {
                            // Template mode — auto-render from parsed HTML
                            const R = template_render_mod.TemplateRenderer(components[i]);
                            R.render(&pool_ptr.instance_nodes[inst], cmd, parent);
                        }
                    }
                }
            }
        }

        /// Route a DOM event to the owning component instance via O(1) lookup.
        pub fn handleEvent(event: *const event_ring_mod.EventRecord, dirty_queue: *signal_mod.DirtyQueue(max_nodes)) bool {
            assert(event.node_id < max_nodes);

            const owner = node_owners[event.node_id];
            if (owner.isUnowned()) return false;

            inline for (0..components.len) |i| {
                if (owner.type_id == i) {
                    components[i].handleEvent(
                        &pools[i].states[owner.instance_id],
                        event,
                        dirty_queue,
                    );
                    return true;
                }
            }

            return false;
        }

        /// Route a dirty node to the owning component's update function via O(1) lookup.
        pub fn updateDirty(dirty_node: u16, cmd: *component.CommandWriter) bool {
            assert(dirty_node < max_nodes);

            const owner = node_owners[dirty_node];
            if (owner.isUnowned()) return false;

            inline for (0..components.len) |i| {
                if (owner.type_id == i) {
                    const ctx = UpdateContext(i){ .instance_id = owner.instance_id };
                    components[i].update(&pools[i].states[owner.instance_id], cmd, ctx);
                    return true;
                }
            }

            return false;
        }

        /// Context passed to component update functions.
        fn UpdateContext(comptime type_idx: usize) type {
            return struct {
                instance_id: u8,

                /// Look up a node by its slot index within this instance.
                pub fn nodeBySlot(self: @This(), slot: u16) u16 {
                    const slots = comptime nodeSlotCount(components[type_idx]);
                    if (slots > 0) {
                        assert(slot < slots);
                        return pools[type_idx].instance_nodes[self.instance_id][slot];
                    }
                    return 0xFFFF;
                }

                /// Look up a node by its `data-bind` name (template-mode only).
                pub fn node(self: @This(), comptime bind_name: []const u8) u16 {
                    if (!component.isImperativeMode(components[type_idx])) {
                        const R = template_render_mod.TemplateRenderer(components[type_idx]);
                        const idx = comptime R.nodeIndex(bind_name);
                        return pools[type_idx].instance_nodes[self.instance_id][idx];
                    }
                    @compileError("node() is only available for template-mode components");
                }
            };
        }

        /// Get the number of registered component types.
        pub fn componentCount() u16 {
            return @intCast(components.len);
        }

        /// Get the manifest binary blob for JS runtime consumption.
        pub fn getManifest() []const u8 {
            assert(Registry.manifest.len > 0);
            return Registry.manifest;
        }

        /// Get the length of the manifest blob.
        pub fn getManifestLen() u32 {
            const len = Registry.manifest.len;
            assert(len > 0);
            assert(len <= 65535);
            return @intCast(len);
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Mock component for testing — satisfies the full contract.
const MockComponentA = struct {
    pub const metadata = component.Metadata{ .name = "z-mock-a", .max_instances = 4 };
    pub const style = "div { color: red; }";
    pub const template = "<div></div>";
    pub const State = struct {
        nodes: [2]u16 = .{ 0, 0 },
        dummy: u8 = 0,
    };
    pub fn render(_: *State, _: *component.CommandWriter, _: u16) void {}
    pub fn update(_: *State, _: *component.CommandWriter, _: anytype) void {}
    pub fn handleEvent(_: *State, _: *const event_ring_mod.EventRecord, _: anytype) void {}
    pub fn subscribe(_: *State) void {}
};

/// Second mock component for multi-component tests.
const MockComponentB = struct {
    pub const metadata = component.Metadata{ .name = "z-mock-b", .max_instances = 4 };
    pub const style = "span { color: blue; }";
    pub const template = "<span></span>";
    pub const State = struct {
        nodes: [3]u16 = .{ 0, 0, 0 },
        value: u32 = 0,
    };
    pub fn render(_: *State, _: *component.CommandWriter, _: u16) void {}
    pub fn update(_: *State, _: *component.CommandWriter, _: anytype) void {}
    pub fn handleEvent(_: *State, _: *const event_ring_mod.EventRecord, _: anytype) void {}
    pub fn subscribe(_: *State) void {}
};

test "InstancePool: claim and release" {
    var pool: InstancePool(MockComponentA) = .{};

    const id0 = pool.claim(10).?;
    try std.testing.expectEqual(@as(u16, 0), id0);
    try std.testing.expectEqual(@as(u16, 1), pool.instance_count);
    try std.testing.expect(pool.active[0]);
    try std.testing.expect(pool.pending_render[0]);

    const id1 = pool.claim(11).?;
    try std.testing.expectEqual(@as(u16, 1), id1);
    try std.testing.expectEqual(@as(u16, 2), pool.instance_count);

    pool.release(0);
    try std.testing.expectEqual(@as(u16, 1), pool.instance_count);
    try std.testing.expect(!pool.active[0]);

    // Can reclaim slot 0
    const id2 = pool.claim(12).?;
    try std.testing.expectEqual(@as(u16, 0), id2);
}

test "InstancePool: pool exhaustion" {
    var pool: InstancePool(MockComponentA) = .{};

    // max_instances = 4
    _ = pool.claim(10).?;
    _ = pool.claim(11).?;
    _ = pool.claim(12).?;
    _ = pool.claim(13).?;

    try std.testing.expect(pool.claim(14) == null);
}

test "App: createInstance allocates nodes and sets ownership" {
    const TestApp = App(&.{MockComponentA}, 256);
    var node_pool: node_pool_mod.NodePool(256) = .{};
    node_pool.init();

    TestApp.init(&node_pool);

    // Allocate a host node
    const host = node_pool.alloc().?;
    const instance_id = TestApp.createInstance(0, host, &node_pool);
    try std.testing.expect(instance_id != 0xFFFF);

    // Check ownership of host node
    const host_owner = TestApp.node_owners[host];
    try std.testing.expectEqual(@as(u8, 0), host_owner.type_id);
    try std.testing.expectEqual(@as(u8, @intCast(instance_id)), host_owner.instance_id);
}

test "App: O(1) event routing to correct instance" {
    const TestApp = App(&.{MockComponentA}, 256);
    var node_pool: node_pool_mod.NodePool(256) = .{};
    node_pool.init();

    TestApp.init(&node_pool);

    const host = node_pool.alloc().?;
    _ = TestApp.createInstance(0, host, &node_pool);

    // Event on host node should route successfully
    var dq: signal_mod.DirtyQueue(256) = .{};
    const event = event_ring_mod.EventRecord{
        .node_id = host,
        .event_id = 0x01,
        .payload = .{0} ** 8,
        .payload_len = 0,
    };
    const handled = TestApp.handleEvent(&event, &dq);
    try std.testing.expect(handled);

    // Event on unowned node should not route
    const event2 = event_ring_mod.EventRecord{
        .node_id = 200,
        .event_id = 0x01,
        .payload = .{0} ** 8,
        .payload_len = 0,
    };
    const handled2 = TestApp.handleEvent(&event2, &dq);
    try std.testing.expect(!handled2);
}

test "App: manifest is non-empty" {
    const TestApp = App(&.{MockComponentA}, 256);
    const manifest = TestApp.getManifest();
    try std.testing.expect(manifest.len > 0);
}

test "App: componentCount" {
    const TestApp = App(&.{ MockComponentA, MockComponentB }, 256);
    try std.testing.expectEqual(@as(u16, 2), TestApp.componentCount());
}

/// Template-mode mock — no render, no subscribe, no nodes in State.
const MockTemplateCounter = struct {
    pub const metadata = component.Metadata{ .name = "z-tmpl-counter", .max_instances = 4 };
    pub const style = "z-tmpl-counter span { color: blue; }";
    pub const template = "<div><button data-on-click>+1</button><span data-bind=\"count\">0</span></div>";
    pub const State = struct {
        count: u32 = 0,
        str_buf: [16]u8 = undefined,
    };
    pub fn update(state: *State, cmd: *component.CommandWriter, ctx: anytype) void {
        const count_str = component.u32ToStr(state.count, &state.str_buf);
        cmd.setText(ctx.node("count"), count_str);
    }
    pub fn handleEvent(state: *State, event: *const event_ring_mod.EventRecord, dirty_queue: anytype) void {
        if (event.event_id == 0x01) {
            state.count +%= 1;
            dirty_queue.push(event.node_id);
        }
    }
};

test "App: template-mode component creates instance and renders" {
    const TestApp = App(&.{MockTemplateCounter}, 256);
    var node_pool: node_pool_mod.NodePool(256) = .{};
    node_pool.init();

    TestApp.init(&node_pool);

    const host = node_pool.alloc().?;
    const instance_id = TestApp.createInstance(0, host, &node_pool);
    try std.testing.expect(instance_id != 0xFFFF);

    // Render pending should emit commands
    var buf: [2048]u8 = @splat(0);
    var str: [512]u8 = undefined;
    var cmd: component.CommandWriter = undefined;
    component.CommandWriter.init(&cmd, &buf, &str);

    TestApp.renderPending(&cmd);
    // Template has div + button + span = 3 elements = 3 createNode
    // Plus setText("+1") + setText("0") + addListener = 3 more
    try std.testing.expectEqual(@as(u32, 6), cmd.command_count);
}

test "App: template-mode event + update cycle" {
    const TestApp = App(&.{MockTemplateCounter}, 256);
    var node_pool: node_pool_mod.NodePool(256) = .{};
    node_pool.init();

    TestApp.init(&node_pool);

    const host = node_pool.alloc().?;
    _ = TestApp.createInstance(0, host, &node_pool);

    // Simulate a click on the host node
    var dq: signal_mod.DirtyQueue(256) = .{};
    const event = event_ring_mod.EventRecord{
        .node_id = host,
        .event_id = 0x01,
        .payload = .{0} ** 8,
        .payload_len = 0,
    };
    const handled = TestApp.handleEvent(&event, &dq);
    try std.testing.expect(handled);

    // Dirty queue should have the host node
    try std.testing.expect(!dq.isEmpty());

    // Flush dirty queue
    var buf: [2048]u8 = @splat(0);
    var str: [512]u8 = undefined;
    var cmd: component.CommandWriter = undefined;
    component.CommandWriter.init(&cmd, &buf, &str);

    const dirty_node = dq.popNext().?;
    const updated = TestApp.updateDirty(dirty_node, &cmd);
    try std.testing.expect(updated);
    // update() should have emitted a setText command
    try std.testing.expectEqual(@as(u32, 1), cmd.command_count);
}

/// Template-mode static mock — no interactivity at all.
const MockTemplateStatic = struct {
    pub const metadata = component.Metadata{ .name = "z-tmpl-static", .max_instances = 4 };
    pub const style = "z-tmpl-static h1 { color: white; }";
    pub const template = "<div><h1>Hello</h1><p>World</p></div>";
    pub const State = struct {
        _pad: u8 = 0,
    };
    pub fn update(_: *State, _: *component.CommandWriter, _: anytype) void {}
    pub fn handleEvent(_: *State, _: *const event_ring_mod.EventRecord, _: anytype) void {}
};

test "App: mixed imperative + template-mode components" {
    const TestApp = App(&.{ MockComponentA, MockTemplateStatic }, 256);
    var node_pool: node_pool_mod.NodePool(256) = .{};
    node_pool.init();

    TestApp.init(&node_pool);

    // Create one of each
    const host_a = node_pool.alloc().?;
    const id_a = TestApp.createInstance(0, host_a, &node_pool);
    try std.testing.expect(id_a != 0xFFFF);

    const host_b = node_pool.alloc().?;
    const id_b = TestApp.createInstance(1, host_b, &node_pool);
    try std.testing.expect(id_b != 0xFFFF);

    try std.testing.expectEqual(@as(u16, 2), TestApp.componentCount());
}
