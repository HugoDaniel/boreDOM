const http = require("http");
const fs = require("fs");
const path = require("path");

const MIMES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const SERVER_ROOT = __dirname;
const SERVER_ROOT_PREFIX = SERVER_ROOT.endsWith(path.sep)
  ? SERVER_ROOT
  : `${SERVER_ROOT}${path.sep}`;

function resolveSafePath(requestUrl) {
  const rawUrl = typeof requestUrl === "string" ? requestUrl : "/";
  const pathname = rawUrl.split("?")[0].split("#")[0];
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_err) {
    return { errorCode: 400, message: "Bad request" };
  }

  const normalizedPath = decodedPath.replace(/\\/g, "/");
  const targetPath = normalizedPath === "/" ? "/index.html" : normalizedPath;
  const relativeTarget = targetPath.startsWith("/")
    ? `.${targetPath}`
    : `./${targetPath}`;
  const resolvedPath = path.resolve(SERVER_ROOT, relativeTarget);
  const inRoot =
    resolvedPath === SERVER_ROOT ||
    resolvedPath.startsWith(SERVER_ROOT_PREFIX);

  if (!inRoot) {
    return { errorCode: 403, message: "Forbidden" };
  }

  return { filePath: resolvedPath };
}

const server = http.createServer((req, res) => {
  const resolved = resolveSafePath(req.url);
  if (resolved.errorCode) {
    res.writeHead(resolved.errorCode, { "Content-Type": "text/plain" });
    res.end(resolved.message);
    return;
  }

  const { filePath } = resolved;
  const ext = path.extname(filePath);
  const contentType = MIMES[ext] || "text/plain";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

const PORT = Number(process.env.PORT) || 49000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
