#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const pretty = require("pretty");
const { Command } = require("commander");
const http = require("http");

const program = new Command();

program
  .argument("<htmlFile>", "Path to the HTML file")
  .option(
    "-c, --cssDir <dir>",
    "Directory to search for CSS files (defaults to current directory)",
    ".",
  )
  .option(
    "-h, --htmlDir <dir>",
    "Directory to search for HTML files (defaults to current directory)",
    ".",
  )
  .option(
    "-p, --port <port>",
    "Port to serve the HTML file (defaults to 3000)",
    "3000",
  )
  .option("--serve", "Serve the HTML file locally")
  .action(async (htmlFile, options) => {
    const cssDir = options.cssDir;
    const htmlDir = options.htmlDir;
    const port = parseInt(options.port, 10);

    try {
      const htmlContent = fs.readFileSync(htmlFile, "utf8");
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      const head = document.head;
      if (!head) {
        console.error("Error: <head> tag not found in HTML file.");
        process.exit(1);
      }
      const existingCSSLinks = new Set();
      head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        existingCSSLinks.add(link.getAttribute("href"));
      });

      const cssFiles = findCSSFiles(cssDir);

      cssFiles.forEach((cssFile) => {
        const relativePath = path.relative(path.dirname(htmlFile), cssFile); // Relative to HTML file
        if (!existingCSSLinks.has(relativePath)) {
          const linkTag = document.createElement("link");
          linkTag.rel = "stylesheet";
          linkTag.href = relativePath;
          head.appendChild(linkTag);
          console.log(`Added CSS link: ${relativePath}`);
        } else {
          console.log(`CSS link already exists: ${relativePath}`);
        }
      });

      const htmlFileContents = new Map();
      const htmlFiles = findHTMLFiles(htmlDir);

      if (htmlFiles.length > 0) {
        htmlFiles.forEach((filePath) => {
          const relativePath = path.relative(path.dirname(htmlFile), filePath); // Relative to HTML file
          try {
            const fileContent = fs.readFileSync(filePath, "utf8");
            htmlFileContents.set(relativePath, fileContent);
          } catch (err) {
            console.error(`Error reading ${relativePath}: ${err.message}`);
            htmlFileContents.set(relativePath, `Error: ${err.message}`); // Store the error message
          }
        });
      }

      let updatedHtml = dom.serialize();
      const [startHtml, endHtml] = updatedHtml.split("</body>");
      let finalHtml = startHtml;
      for (let [fname, contents] of htmlFileContents.entries()) {
        if (fname !== htmlFile && fname !== "index.html") {
          finalHtml += contents;
        }
      }
      finalHtml += "</body>" + endHtml;
      finalHtml = pretty(finalHtml);

      if (options.serve) {
        const server = http.createServer((req, res) => {
          const parsedUrl = new URL(req.url, `http://localhost:${port}`);
          let filePath = path.join(path.dirname(htmlFile), parsedUrl.pathname);

          if (parsedUrl.pathname === "/") {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(finalHtml);
            return;
          }

          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.writeHead(404);
              res.end("File not found");
              return;
            }

            let contentType = "text/plain";
            if (path.extname(filePath) === ".css") {
              contentType = "text/css";
            } else if (path.extname(filePath) === ".js") {
              contentType = "text/javascript";
            } else if (path.extname(filePath) === ".png") {
              contentType = "image/png";
            } else if (
              path.extname(filePath) === ".jpg" ||
              path.extname(filePath) === ".jpeg"
            ) {
              contentType = "image/jpeg";
            } else if (path.extname(filePath) === ".svg") {
              contentType = "image/svg+xml";
            }
            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
          });
        });

        server.listen(port, () => {
          console.log(`Serving ${htmlFile} on http://localhost:${port}`);
        });
      } else {
        fs.writeFileSync(htmlFile, finalHtml, "utf8");
        console.log(`Successfully added CSS links to ${htmlFile}`);
      }
    } catch (err) {
      console.error(`Error processing file: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

function findAllFiles(extension, dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      // Recursively search subdirectories
      findAllFiles(extension, filePath, fileList);
    } else if (path.extname(file) === extension) {
      // Add CSS file to the list
      fileList.push(filePath);
    }
  });

  return fileList;
}

function findCSSFiles(dir) {
  return findAllFiles(".css", dir);
}

function findHTMLFiles(dir) {
  return findAllFiles(".html", dir);
}

/*
// Get the current directory
const currentDir = process.cwd();

const cssFiles = findCSSFiles(currentDir);
const cssRelativePaths = [];

if (cssFiles.length > 0) {
  cssFiles.forEach((filePath) => {
    // Get the relative path
    cssRelativePaths.push(path.relative(currentDir, filePath));
  });
} else {
  console.log("No CSS files found in this directory or its subdirectories.");
}

const htmlFileContents = new Map();
const htmlFiles = findHTMLFiles(currentDir);

if (htmlFiles.length > 0) {
  htmlFiles.forEach((filePath) => {
    const relativePath = path.relative(currentDir, filePath);
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      htmlFileContents.set(relativePath, fileContent);
    } catch (err) {
      console.error(`Error reading ${relativePath}: ${err.message}`);
      htmlFileContents.set(relativePath, `Error: ${err.message}`); // Store the error message
    }
  });

  // Now you can work with the Map:
  console.log("CSS File Contents (in a Map):");
  cssFileContents.forEach((content, relativePath) => {
    console.log(
      `\nContent of ${relativePath}:\n${content.substring(0, 200)}...`,
    ); // Print first 200 chars
  });

  //Accessing a specific file's content
  const mainCssContent = cssFileContents.get("src/main.css");
  if (mainCssContent) {
    console.log(
      `\nSpecific content of src/main.css:\n${
        mainCssContent.substring(0, 200)
      }...`,
    );
  }
}
*/
