//! boreDOM application root.
//!
//! Components are auto-discovered by build.zig from src/components/*.zig.
//! No manual imports needed — just drop .zig files into src/components/.

const boredom = @import("boredom");
const components = @import("components");

const GeneratedApp = boredom.App(components.all, 2048);

pub const init = GeneratedApp.init;
pub const createInstance = GeneratedApp.createInstance;
pub const destroyInstance = GeneratedApp.destroyInstance;
pub const renderPending = GeneratedApp.renderPending;
pub const handleEvent = GeneratedApp.handleEvent;
pub const updateDirty = GeneratedApp.updateDirty;
pub const getManifest = GeneratedApp.getManifest;
pub const getManifestLen = GeneratedApp.getManifestLen;
pub const componentCount = GeneratedApp.componentCount;
