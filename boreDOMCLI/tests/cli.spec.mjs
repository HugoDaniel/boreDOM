import fs from "fs/promises";
import path from "path";
import os from "os";
import * as cheerio from "cheerio";
import { describe, it, before, beforeEach, afterEach } from "mocha";
import { strict as assert } from "assert";

process.env.BOREDOM_CLI_TEST_MODE = "1";

let build;
let options;
let setServePaths;
let getServePaths;
let normalizeServePath;

before(async () => {
  ({
    build,
    options,
    setServePaths,
    getServePaths,
    normalizeServePath,
  } = await import(new URL("../cli.js", import.meta.url)));
});

describe("CLI serve path configuration", () => {
  let cwd;
  let tempDir;

  beforeEach(async () => {
    cwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "boredom-cli-test-"));
    process.chdir(tempDir);

    globalThis.boredom = Buffer.from("console.log('stub runtime');").toString("base64");
    if (typeof globalThis.atob !== "function") {
      globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
    }

    await fs.writeFile(
      "index.html",
      "<!DOCTYPE html><html><head></head><body><div id=app></div></body></html>",
    );

    await fs.mkdir("components", { recursive: true });
    await fs.writeFile(
      path.join("components", "demo.html"),
      "<template data-component=\"demo\"><p>Demo component</p></template>",
    );
    await fs.writeFile(
      path.join("components", "demo.js"),
      "export default function demo() { console.log('demo'); }",
    );
    await fs.writeFile(
      path.join("components", "demo.css"),
      ".demo { color: red; }",
    );

    await fs.mkdir("public", { recursive: true });
    await fs.writeFile(path.join("public", "site.txt"), "static-asset");
    await fs.writeFile(path.join("public", "shared.txt"), "from-public");

    await fs.mkdir("extra-static", { recursive: true });
    await fs.writeFile(path.join("extra-static", "extra.txt"), "from-extra");
    await fs.writeFile(path.join("extra-static", "shared.txt"), "from-extra-static");

    options.index = "index.html";
    options.html = "components";
    options.static = ["public"];
    delete options.componentsServe;
    delete options.staticServe;
    setServePaths(options);
  });

  afterEach(async () => {
    process.chdir(cwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    options.index = "index.html";
    options.html = "components";
    options.static = ["public"];
    delete options.componentsServe;
    delete options.staticServe;
    setServePaths(options);
  });

  it("writes assets to custom serve targets and updates index references", async () => {
    options.componentsServe = "assets/components";
    options.static = ["public", "extra-static"];
    options.staticServe = "assets/static";
    setServePaths(options);

    await build();

    const indexContent = await fs.readFile(path.join("build", "index.html"), "utf8");
    assert.ok(
      indexContent.includes(
        '<script src="./assets/components/demo/demo.js" type="module"></script>',
      ),
      "expected script tag to reference remapped component path",
    );
    assert.ok(
      indexContent.includes(
        '<link rel="stylesheet" href="./assets/components/demo/demo.css">',
      ),
      "expected stylesheet link to reference remapped component path",
    );

    const jsStat = await fs.stat(
      path.join("build", "assets", "components", "demo", "demo.js"),
    );
    assert.ok(jsStat.isFile());
    const cssStat = await fs.stat(
      path.join("build", "assets", "components", "demo", "demo.css"),
    );
    assert.ok(cssStat.isFile());
    const staticFile = await fs.readFile(
      path.join("build", "assets", "static", "site.txt"),
      "utf8",
    );
    assert.equal(staticFile, "static-asset");

    const extraFile = await fs.readFile(
      path.join("build", "assets", "static", "extra.txt"),
      "utf8",
    );
    assert.equal(extraFile, "from-extra");

    const sharedFile = await fs.readFile(
      path.join("build", "assets", "static", "shared.txt"),
      "utf8",
    );
    assert.equal(sharedFile, "from-extra-static");
  });

  it("copies static assets to the build root by default", async () => {
    setServePaths(options);

    await build();

    const site = await fs.readFile(path.join("build", "site.txt"), "utf8");
    assert.equal(site, "static-asset");

    const shared = await fs.readFile(path.join("build", "shared.txt"), "utf8");
    assert.equal(shared, "from-public");
  });

  it("normalizes pre-existing component script paths", async () => {
    await fs.writeFile(
      "index.html",
      "<!DOCTYPE html><html><head></head><body><script type=\"module\" src=\"components/demo/demo.js\"></script></body></html>",
    );

    setServePaths(options);

    await build();

    const indexContent = await fs.readFile(path.join("build", "index.html"), "utf8");
    const $ = cheerio.load(indexContent);
    const normalized = $('script[src="./components/demo/demo.js"]');
    assert.equal(normalized.attr("type"), "module");
  });

  it("supports absolute serve roots", async () => {
    options.componentsServe = "/components";
    options.static = ["public"];
    options.staticServe = "/";
    setServePaths(options);

    await build();

    const indexContent = await fs.readFile(path.join("build", "index.html"), "utf8");
    assert.ok(
      indexContent.includes(
        '<script src="/components/demo/demo.js" type="module"></script>',
      ),
      "expected script tag to use absolute component path",
    );

    const jsFile = await fs.stat(
      path.join("build", "components", "demo", "demo.js"),
    );
    assert.ok(jsFile.isFile());

    const staticCandidates = [
      path.join("build", "site.txt"),
      path.join("build", "public", "site.txt"),
    ];
    let staticFound = false;
    for (const candidate of staticCandidates) {
      try {
        await fs.stat(candidate);
        staticFound = true;
        break;
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }
    assert.ok(staticFound, "expected static file to be copied for absolute root");
  });

  it("normalizes user-supplied serve directories", () => {
    const normalized = normalizeServePath("/custom/components/", "components");
    assert.deepEqual(normalized, {
      fsPath: "custom/components",
      urlPath: "/custom/components",
    });

    const currentPaths = setServePaths({
      componentsServe: "/nested/",
      staticServe: "./public-assets/",
    });

    assert.deepEqual(currentPaths, {
      componentsServePath: "nested",
      componentsServeUrlPath: "/nested",
      staticServePath: "public-assets",
      staticServeUrlPath: "public-assets",
    });

    const latest = getServePaths();
    assert.deepEqual(latest, {
      componentsServePath: "nested",
      componentsServeUrlPath: "/nested",
      staticServePath: "public-assets",
      staticServeUrlPath: "public-assets",
    });
  });
});
