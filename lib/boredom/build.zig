//! boreDOM framework package build script.
//!
//! Exposes the `boredom` module for package consumers and runs
//! framework-internal tests (no module wiring needed — file-relative imports).

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Expose root module for package consumers
    _ = b.addModule("boredom", .{ .root_source_file = b.path("src/boredom.zig") });

    // Framework-internal tests (no module wiring needed — file-relative imports)
    const test_step = b.step("test", "Run framework tests");
    const test_files = [_][]const u8{
        "src/command.zig",
        "src/signal.zig",
        "src/event_ring.zig",
        "src/node_pool.zig",
        "src/component.zig",
        "src/registry.zig",
        "src/template.zig",
        "src/template_render.zig",
        "src/app_framework.zig",
    };
    for (test_files) |path| {
        const t = b.addTest(.{
            .root_module = b.createModule(.{
                .root_source_file = b.path(path),
                .target = target,
                .optimize = optimize,
            }),
        });
        test_step.dependOn(&b.addRunArtifact(t).step);
    }
}
