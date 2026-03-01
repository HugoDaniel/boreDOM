//! boreDOM application build script.
//! Auto-discovers components in src/components/*.zig.

const std = @import("std");
const Io = std.Io;

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const boredom_dep = b.dependency("boredom", .{});
    const boredom_mod = boredom_dep.module("boredom");
    const io = b.graph.io;

    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    // --- Auto-discover components ---
    var names: std.ArrayList([]const u8) = .empty;
    var comp_imports: std.ArrayList(std.Build.Module.Import) = .empty;

    var dir = Io.Dir.cwd().openDir(io, "src/components", .{ .iterate = true }) catch
        @panic("Cannot open src/components/");
    defer dir.close(io);
    var iter = dir.iterate();
    while (iter.next(io) catch @panic("iterate failed")) |entry| {
        if (entry.kind != .file) continue;
        if (!std.mem.endsWith(u8, entry.name, ".zig")) continue;
        const mod_name = b.dupe(entry.name[0 .. entry.name.len - 4]);
        const comp_mod = b.createModule(.{
            .root_source_file = b.path(
                b.fmt("src/components/{s}", .{entry.name}),
            ),
            .imports = &.{.{ .name = "boredom", .module = boredom_mod }},
        });
        names.append(b.allocator, mod_name) catch @panic("OOM");
        comp_imports.append(b.allocator, .{ .name = mod_name, .module = comp_mod }) catch @panic("OOM");
    }

    // --- Generate components.zig ---
    const wf = b.addWriteFiles();
    var gen_src: []const u8 = "";
    for (names.items) |name| {
        gen_src = std.fmt.allocPrint(b.allocator, "{s}pub const @\"{s}\" = @import(\"{s}\");\n", .{ gen_src, name, name }) catch @panic("OOM");
    }
    gen_src = std.fmt.allocPrint(b.allocator, "{s}pub const all = &.{{ ", .{gen_src}) catch @panic("OOM");
    for (names.items, 0..) |name, i| {
        if (i > 0) {
            gen_src = std.fmt.allocPrint(b.allocator, "{s}, ", .{gen_src}) catch @panic("OOM");
        }
        gen_src = std.fmt.allocPrint(b.allocator, "{s}@\"{s}\"", .{ gen_src, name }) catch @panic("OOM");
    }
    gen_src = std.fmt.allocPrint(b.allocator, "{s} }};\n", .{gen_src}) catch @panic("OOM");
    const components_zig = wf.add("components.zig", gen_src);

    const components_mod = b.createModule(.{
        .root_source_file = components_zig,
        .imports = comp_imports.items,
    });

    // --- App module ---
    const app_mod = b.createModule(.{
        .root_source_file = b.path("src/app.zig"),
        .imports = &.{
            .{ .name = "boredom", .module = boredom_mod },
            .{ .name = "components", .module = components_mod },
        },
    });

    // --- WASM executable (uses framework's wasm.zig, injects app) ---
    const wasm_exe = b.addExecutable(.{
        .name = "boredom",
        .root_module = b.createModule(.{
            .root_source_file = boredom_dep.path("src/platform/wasm.zig"),
            .target = wasm_target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "app", .module = app_mod },
                .{ .name = "boredom", .module = boredom_mod },
            },
        }),
    });
    wasm_exe.entry = .disabled;
    wasm_exe.rdynamic = true;
    wasm_exe.root_module.link_libc = false;

    // --- Install WASM + JS ---
    const install_wasm = b.addInstallFile(wasm_exe.getEmittedBin(), "../web/boredom.wasm");
    const install_js = b.addInstallFile(boredom_dep.path("web/boredom.js"), "../web/boredom.js");

    const web_step = b.step("web", "Build the boreDOM WASM binary");
    web_step.dependOn(&install_wasm.step);
    web_step.dependOn(&install_js.step);

    // --- Copy component CSS files to web/components/ ---
    for (names.items) |name| {
        const css_path = b.fmt("src/components/{s}.css", .{name});
        // Check if CSS file exists by trying to resolve the path
        const install_css = b.addInstallFile(
            b.path(css_path),
            b.fmt("../web/components/{s}.css", .{name}),
        );
        web_step.dependOn(&install_css.step);
    }

    // --- Tests ---
    const test_step = b.step("test", "Run tests");
    for (comp_imports.items) |imp| {
        const t = b.addTest(.{
            .root_module = b.createModule(.{
                .root_source_file = b.path(
                    b.fmt("src/components/{s}.zig", .{imp.name}),
                ),
                .target = target,
                .optimize = optimize,
                .imports = &.{.{ .name = "boredom", .module = boredom_mod }},
            }),
        });
        test_step.dependOn(&b.addRunArtifact(t).step);
    }
}
