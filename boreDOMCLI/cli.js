import fs from "fs-extra";
import mime from "mime-types";
import path from "path";
import * as glob from "glob";
import * as cheerio from "cheerio";
import { program } from "commander";
import http from "http";
import finalhandler from "finalhandler";
import jsBeautify from "js-beautify";
import chokidar from "chokidar";
import handler from "serve-handler";
import net from "net";
// import * as esbuild from "esbuild";

const beautify = jsBeautify.html;

const BUILD_DIR = "build";
let serverStarted = false;
let numberOfRefreshes = 0;

console.log("## boreDOM CLI options");
console.log(
  "## ",
  "--index <path to default html>",
  "The base HTML file to serve",
  "defaults to ./index.html",
);
console.log(
  "## ",
  "--html <folder>",
  "Folder containing HTML component files",
  'defaults to "./components"',
);
console.log(
  "## ",
  "--static <folder>",
  "Static files folder, all files in here are copied as is",
  'defaults to "./public"',
);
// console.log(
//   "## ",
//   "--bundle <folder>",
//   "Folder containing JS/TS files to be bundled (using esbuild)",
//   'defaults to "src"',
// );

program
  .option("--index <path to file>", "Index file to serve", "index.html")
  .option(
    "--html <folder>",
    "Folder containing HTML component files",
    "components",
  )
  .option(
    "--static <folder>",
    "Folder containing static files to be copied as is",
    "public",
  )
  // .option(
  //   "--bundle <folder>",
  //   "Folder containing files to be bundled",
  //   "components", 0; //
  // )
  .parse(process.argv);

const options = program.opts();

async function copyStatic() {
  const staticDir = path.resolve(options.static);
  if (await fs.pathExists(staticDir)) {
    await fs.copy(staticDir, path.join(BUILD_DIR, "static"));
    console.log("Static folder copied.");
  }
}

async function copyBoreDOM() {
  return fs.writeFile(path.join(BUILD_DIR, "boreDOM.js"), atob(boredom));
}

async function processComponents() {
  let components = {};

  if (options.html) {
    const htmlFolder = path.resolve(options.html);
    const htmlFiles = glob.sync("**/*.html", { cwd: htmlFolder });
    for (const file of htmlFiles) {
      const filePath = path.join(htmlFolder, file);
      const content = await fs.readFile(filePath, "utf-8");
      const $ = cheerio.load(content, { decodeEntities: false });
      const template = $("template[data-component]");
      if (template.length) {
        const componentName = template.attr("data-component");
        const fullTemplate = $.html(template);

        // Create a dedicated folder for this component
        const componentBuildDir = path.join(
          BUILD_DIR,
          "components",
          componentName,
        );
        await fs.ensureDir(componentBuildDir);

        // Copy the HTML file into the component folder
        const destHtmlPath = path.join(
          componentBuildDir,
          `${componentName}.html`,
        );
        await fs.copy(filePath, destHtmlPath);
        console.log(`Copied ${componentName}.html to ${componentBuildDir}`);

        // Look for corresponding JS and CSS files (even in subfolders)
        const componentDir = path.dirname(filePath);
        const jsMatch = glob.sync(`**/${componentName}.js`, {
          cwd: componentDir,
        });
        const cssMatch = glob.sync(`**/${componentName}.css`, {
          cwd: componentDir,
        });

        const hasJS = jsMatch.length > 0;
        if (jsMatch.length > 0) {
          const jsSrc = path.join(componentDir, jsMatch[0]);
          const destJsPath = path.join(
            componentBuildDir,
            `${componentName}.js`,
          );
          await fs.copy(jsSrc, destJsPath);
          console.log(`Copied ${componentName}.js to ${componentBuildDir}`);
        }
        const hasCSS = cssMatch.length > 0;
        if (cssMatch.length > 0) {
          const cssSrc = path.join(componentDir, cssMatch[0]);
          const destCssPath = path.join(
            componentBuildDir,
            `${componentName}.css`,
          );
          await fs.copy(cssSrc, destCssPath);
          console.log(`Copied ${componentName}.css to ${componentBuildDir}`);
        }

        components[componentName] = {
          templateTag: fullTemplate,
          hasJS,
          hasCSS,
        };
      }
    }
  }
  return components;
}

async function updateIndex(components) {
  console.log(
    "Updated index.html with components:\n\n",
    JSON.stringify(components, null, 2),
  );
  const indexPath = path.resolve(options.index);
  let indexContent = await fs.readFile(indexPath, "utf-8");
  const $ = cheerio.load(indexContent, { decodeEntities: false });
  $("head").prepend(
    `\n  <script type="importmap">{ "imports": {\
      "@mr_hugo/boredom/dist/boreDOM.full.js": "./boreDOM.js",\n \
      "boredom": "./boreDOM.js"\n \
    } }</script>`,
  );
  $("body").append(`\n  <script src="boreDOM.js" type="module"></script>`);

  // For each component, add references to its JS/CSS files and inject its full <template> tag
  Object.keys(components).forEach((component) => {
    if (
      components[component].hasJS &&
      $(`script[src="./components/${component}/${component}.js"]`).length === 0
    ) {
      $("body").append(
        `\n  <script src="./components/${component}/${component}.js" type="module"></script>`,
      );
      console.log(`Added script reference for ${component}`);
    }
    if (
      components[component].hasCSS &&
      $(`link[href="components/${component}/${component}.css"]`).length === 0
    ) {
      $("head").append(
        `\n  <link rel="stylesheet" href="components/${component}/${component}.css">`,
      );
      console.log(`Added stylesheet reference for ${component}`);
    }
    if ($(`template[data-component="${component}"]`).length === 0) {
      $("body").append(`\n  ${components[component].templateTag}`);
      console.log(`Injected template for ${component}`);
    }
  });

  // Remove any <template> tags that no longer correspond to a component file
  $("template[data-component]").each((i, el) => {
    const comp = $(el).attr("data-component");
    if (!components[comp]) {
      $(el).remove();
      console.log(`Removed unused template for ${comp}`);
    }
  });

  // Pretty print the final HTML using js-beautify
  const prettyHtml = beautify($.html(), {
    indent_size: 2,
    space_in_empty_paren: true,
  });
  const buildIndex = path.join(BUILD_DIR, "index.html");
  await fs.outputFile(buildIndex, prettyHtml);
  console.log("Index updated with pretty printed HTML.");
}

async function startServer() {
  if (serverStarted) return;

  function serveFile(req, res, opts) {
    // strip query & hash
    let urlPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
    // default to index.html
    if (urlPath === "/" || urlPath.endsWith("/")) {
      urlPath = path.posix.join(urlPath, "index.html");
    }

    const filePath = path.join(BUILD_DIR, urlPath);

    fs.pathExists(filePath).then((exists) => {
      if (!exists) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not Found");
      }

      // lookup based on extension, fallback to octet-stream
      const contentType = mime.lookup(filePath) || "application/octet-stream";
      console.log("Content type is ", contentType, "for", filePath);
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    }).catch((err) => {
      console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    });
  }

  const server = http.createServer((req, res) => {
    return serveFile(req, res, {
      cleanUrls: true,
      public: path.resolve(BUILD_DIR),
    });
  });

  let port = process.env.PORT || 8080;

  const serverHandler = () => {
    const { port: actualPort } = server.address();
    console.log(`Server running at http://localhost:${actualPort}`);
  };
  server.listen(port, serverHandler);
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log(
        "\x1b[33m%s\x1b[0m",
        `⚠️ Warning: Port ${port} in use, starting with a OS assigned port.`,
      );
      setTimeout(() => {
        server.close();
        server.listen(0);
      }, 1000);
    }
  });
  serverStarted = true;
}

async function build() {
  console.log("Starting build process...");
  // Clean the build directory
  await fs.remove(BUILD_DIR);
  await fs.ensureDir(BUILD_DIR);

  // Run build steps
  await copyStatic();
  await copyBoreDOM();
  const components = await processComponents();
  await updateIndex(components);
  console.log("Build process complete.");
}

async function watchFiles() {
  const pathsToWatch = [];

  // Watch the index file
  if (options.index) {
    pathsToWatch.push(path.resolve(options.index));
  }
  // Watch the components source folder (including all HTML, JS, CSS, etc.)
  if (options.html) {
    pathsToWatch.push(path.resolve(options.html));
  }
  // Watch the static folder if it exists
  const staticDir = path.join(process.cwd(), "static");
  if (await fs.pathExists(staticDir)) {
    pathsToWatch.push(staticDir);
  }
  // Watch the bundle folder
  // if (options.bundle) {
  //   pathsToWatch.push(path.resolve(options.bundle));
  // }

  console.log("Watching for file changes in:", pathsToWatch);
  // chokidar will recursively watch all files in the specified paths
  const watcher = chokidar.watch(pathsToWatch, { ignoreInitial: true });
  let rebuildTimeout;
  watcher.on("all", (event, filePath) => {
    console.log(`Detected ${event} on ${filePath}. Scheduling rebuild...`);
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    // Debounce rebuilds in case multiple file events fire together
    rebuildTimeout = setTimeout(() => {
      build().then(() => {
        console.log(
          `#${++numberOfRefreshes} - ${
            (new Date()).toISOString()
          } - Build refreshed.`,
        );
      }).catch((err) => console.error("Error during rebuild:", err));
    }, 100);
  });
}

async function main() {
  console.log("The file used as the base for HTML is:", options.index);

  const indexPath = path.join(process.cwd(), options.index);
  fs.ensureFile(indexPath, (err) => {
    if (err) {
      // This should not happen. ensureFile creates the file.
      console.log(
        "\x1b[31m%s\x1b[0m",
        `❌ Error: The file "${indexPath}" was not found.\nPlease specify a location for it with "--index"`,
      );
      process.exit(1);
    }
  });

  await build();
  startServer();
  await watchFiles();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
