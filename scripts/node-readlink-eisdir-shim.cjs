const fs = require("node:fs");
const PATCHED = Symbol.for("classforge.next.readlink-eisdir-patched");

// Some Windows volumes report EISDIR for ordinary files/directories. Next's tracing
// expects EINVAL (not a link). Never hide a real link error or an lstat race.
function normalizeReadlinkError(error, path) {
  if (error?.code !== "EISDIR") return error;
  try {
    const stat = fs.lstatSync(path);
    if (!stat.isSymbolicLink() && (stat.isFile() || stat.isDirectory())) {
      error.code = "EINVAL";
      error.message = error.message.replace("EISDIR", "EINVAL");
    }
  } catch {
    // Preserve the original readlink error when the path vanished or is denied.
  }
  return error;
}

// Build preloading and next.config both use this module; patch only once.
if (process.platform === "win32" && !fs[PATCHED]) {
  const originalReadlinkSync = fs.readlinkSync;
  fs.readlinkSync = function readlinkSync(path, options) {
    try {
      return originalReadlinkSync.call(this, path, options);
    } catch (error) {
      throw normalizeReadlinkError(error, path);
    }
  };

  const originalReadlink = fs.readlink;
  fs.readlink = function readlink(path, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = undefined;
    }
    // Let Node retain its normal synchronous argument validation.
    if (typeof callback !== "function") {
      return originalReadlink.call(this, path, options, callback);
    }
    return originalReadlink.call(this, path, options, (error, linkString) => {
      callback(normalizeReadlinkError(error, path), linkString);
    });
  };

  const originalPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = async function readlink(path, options) {
    try {
      return await originalPromisesReadlink.call(this, path, options);
    } catch (error) {
      throw normalizeReadlinkError(error, path);
    }
  };
  fs[PATCHED] = true;
}
