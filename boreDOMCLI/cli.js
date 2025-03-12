const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const cheerio = require('cheerio');
const { program } = require('commander');
const http = require('http');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const beautify = require('js-beautify').html;
const chokidar = require('chokidar');


const BUILD_DIR = 'build';
let serverStarted = false;
let numberOfRefreshes = 0;

program
  .option('--index <file>', 'Index file to serve', 'index.html')
  .option('--html <folder>', 'Folder containing HTML component files')
  .parse(process.argv);

const options = program.opts();

async function copyStatic() {
  const staticDir = path.join(process.cwd(), 'static');
  if (await fs.pathExists(staticDir)) {
    await fs.copy(staticDir, path.join(BUILD_DIR, 'static'));
    console.log('Static folder copied.');
  }
}

async function copyBoreDOM() {
  return fs.writeFile(path.join(BUILD_DIR, 'boreDOM.js'), atob(boredom));
}

async function processComponents() {
  let components = {};

  if (options.html) {
    const htmlFolder = path.resolve(options.html);
    const htmlFiles = glob.sync('**/*.html', { cwd: htmlFolder });
    for (const file of htmlFiles) {
      const filePath = path.join(htmlFolder, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(content, { decodeEntities: false });
      const template = $('template[data-component]');
      if (template.length) {
        const componentName = template.attr('data-component');
        const fullTemplate = $.html(template);

        // Create a dedicated folder for this component
        const componentBuildDir = path.join(BUILD_DIR, 'components', componentName);
        await fs.ensureDir(componentBuildDir);

        // Copy the HTML file into the component folder
        const destHtmlPath = path.join(componentBuildDir, `${componentName}.html`);
        await fs.copy(filePath, destHtmlPath);
        console.log(`Copied ${componentName}.html to ${componentBuildDir}`);

        // Look for corresponding JS and CSS files (even in subfolders)
        const componentDir = path.dirname(filePath);
        const jsMatch = glob.sync(`**/${componentName}.js`, { cwd: componentDir });
        const cssMatch = glob.sync(`**/${componentName}.css`, { cwd: componentDir });

        if (jsMatch.length > 0) {
          const jsSrc = path.join(componentDir, jsMatch[0]);
          const destJsPath = path.join(componentBuildDir, `${componentName}.js`);
          await fs.copy(jsSrc, destJsPath);
          console.log(`Copied ${componentName}.js to ${componentBuildDir}`);
        }
        if (cssMatch.length > 0) {
          const cssSrc = path.join(componentDir, cssMatch[0]);
          const destCssPath = path.join(componentBuildDir, `${componentName}.css`);
          await fs.copy(cssSrc, destCssPath);
          console.log(`Copied ${componentName}.css to ${componentBuildDir}`);
        }

        components[componentName] = { templateTag: fullTemplate };
      }
    }
  }
  return components;
}

async function updateIndex(components) {
  const indexPath = path.resolve(options.index);
  let indexContent = await fs.readFile(indexPath, 'utf-8');
  const $ = cheerio.load(indexContent, { decodeEntities: false });

  // For each component, add references to its JS/CSS files and inject its full <template> tag
  Object.keys(components).forEach(component => {
    if ($(`script[src="components/${component}/${component}.js"]`).length === 0) {
      $('body').append(`\n  <script src="components/${component}/${component}.js" type="module"></script>`);
      console.log(`Added script reference for ${component}`);
    }
    if ($(`link[href="components/${component}/${component}.css"]`).length === 0) {
      $('head').append(`\n  <link rel="stylesheet" href="components/${component}/${component}.css">`);
      console.log(`Added stylesheet reference for ${component}`);
    }
    if ($(`template[data-component="${component}"]`).length === 0) {
      $('body').append(`\n  ${components[component].templateTag}`);
      console.log(`Injected template for ${component}`);
    }
  });

  // Remove any <template> tags that no longer correspond to a component file
  $('template[data-component]').each((i, el) => {
    const comp = $(el).attr('data-component');
    if (!components[comp]) {
      $(el).remove();
      console.log(`Removed unused template for ${comp}`);
    }
  });

  // Pretty print the final HTML using js-beautify
  const prettyHtml = beautify($.html(), { indent_size: 2, space_in_empty_paren: true });
  const buildIndex = path.join(BUILD_DIR, 'index.html');
  await fs.outputFile(buildIndex, prettyHtml);
  console.log('Index updated with pretty printed HTML.');
}

function startServer() {
  if (serverStarted) return;
  const serve = serveStatic(path.resolve(BUILD_DIR));
  const server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  });
  const port = process.env.PORT || 8080;
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
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
  const staticDir = path.join(process.cwd(), 'static');
  if (await fs.pathExists(staticDir)) {
    pathsToWatch.push(staticDir);
  }

  console.log("Watching for file changes in:", pathsToWatch);
  // chokidar will recursively watch all files in the specified paths
  const watcher = chokidar.watch(pathsToWatch, { ignoreInitial: true });
  let rebuildTimeout;
  watcher.on('all', (event, filePath) => {
    console.log(`Detected ${event} on ${filePath}. Scheduling rebuild...`);
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    // Debounce rebuilds in case multiple file events fire together
    rebuildTimeout = setTimeout(() => {
      build().then(() => {
        console.log(`#${++numberOfRefreshes} - ${(new Date()).toISOString()} - Build refreshed.`);
      }).catch(err => console.error("Error during rebuild:", err));
    }, 100);
  });
}

async function main() {
  await build();
  startServer();
  await watchFiles();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

