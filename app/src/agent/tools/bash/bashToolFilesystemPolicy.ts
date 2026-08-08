import type {
  BufferEncoding,
  CpOptions,
  FileContent,
  IFileSystem,
  MkdirOptions,
  RmOptions,
} from "just-bash";

type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];

/**
 * Virtual scratch space where the model is allowed to mutate files.
 */
export const BASH_TOOL_WORKSPACE_ROOT = "/home/user/workspace";

/**
 * Virtual temp directory for familiar shell scratch-file workflows.
 */
export const BASH_TOOL_TMP_ROOT = "/tmp";

/**
 * Null-sink device paths. just-bash has no real device files, so a redirect
 * like `cmd >/dev/null 2>&1` resolves to an ordinary `writeFile("/dev/null")`.
 * That idiom is ubiquitous in model-authored commands, so rather than block it
 * (which aborts the whole command), we treat writes to these paths as silent
 * discards — matching POSIX `/dev/null` semantics.
 */
export const BASH_TOOL_DISCARD_DEVICE_PATHS: ReadonlySet<string> = new Set([
  "/dev/null",
]);

function normalizeVirtualPath(fs: IFileSystem, path: string) {
  return fs.resolvePath("/", path);
}

function isWithinRoot(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`);
}

/**
 * Returns true when `path` resolves to a null-sink device whose writes should
 * be discarded rather than enforced against the workspace policy.
 */
function isDiscardDevicePath(fs: IFileSystem, path: string) {
  return BASH_TOOL_DISCARD_DEVICE_PATHS.has(normalizeVirtualPath(fs, path));
}

function assertWritablePath(fs: IFileSystem, path: string, operation: string) {
  const normalizedPath = normalizeVirtualPath(fs, path);

  if (
    isWithinRoot(normalizedPath, BASH_TOOL_WORKSPACE_ROOT) ||
    isWithinRoot(normalizedPath, BASH_TOOL_TMP_ROOT)
  ) {
    return normalizedPath;
  }

  throw new Error(
    `${operation} is only allowed in ${BASH_TOOL_WORKSPACE_ROOT} or ${BASH_TOOL_TMP_ROOT}. ` +
      `Writes outside scratch directories are blocked.`
  );
}

/**
 * Enforces the Phoenix bash sandbox write policy on a just-bash filesystem.
 */
export function applyBashToolFilesystemPolicy(fs: IFileSystem) {
  /**
   * Wrap filesystem mutation methods with a Phoenix-specific path policy.
   * Writes are allowed under `/home/user/workspace` and `/tmp`, and rejected
   * everywhere else with a clear error.
   */
  const originalWriteFile = fs.writeFile.bind(fs);
  const originalAppendFile = fs.appendFile.bind(fs);
  const originalMkdir = fs.mkdir.bind(fs);
  const originalRm = fs.rm.bind(fs);
  const originalCp = fs.cp.bind(fs);
  const originalMv = fs.mv.bind(fs);
  const originalChmod = fs.chmod.bind(fs);
  const originalSymlink = fs.symlink.bind(fs);
  const originalLink = fs.link.bind(fs);
  const originalUtimes = fs.utimes.bind(fs);

  fs.writeFile = (
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding
  ) => {
    if (isDiscardDevicePath(fs, path)) {
      return Promise.resolve();
    }
    return originalWriteFile(
      assertWritablePath(fs, path, "writeFile"),
      content,
      options
    );
  };

  fs.appendFile = (
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding
  ) => {
    if (isDiscardDevicePath(fs, path)) {
      return Promise.resolve();
    }
    return originalAppendFile(
      assertWritablePath(fs, path, "appendFile"),
      content,
      options
    );
  };

  fs.mkdir = (path: string, options?: MkdirOptions) =>
    originalMkdir(assertWritablePath(fs, path, "mkdir"), options);

  fs.rm = (path: string, options?: RmOptions) =>
    originalRm(assertWritablePath(fs, path, "rm"), options);

  fs.cp = (src: string, dest: string, options?: CpOptions) =>
    originalCp(
      normalizeVirtualPath(fs, src),
      assertWritablePath(fs, dest, "cp"),
      options
    );

  fs.mv = (src: string, dest: string) =>
    originalMv(
      assertWritablePath(fs, src, "mv"),
      assertWritablePath(fs, dest, "mv")
    );

  fs.chmod = (path: string, mode: number) =>
    originalChmod(assertWritablePath(fs, path, "chmod"), mode);

  fs.symlink = (target: string, linkPath: string) =>
    originalSymlink(
      normalizeVirtualPath(fs, target),
      assertWritablePath(fs, linkPath, "symlink")
    );

  fs.link = (existingPath: string, newPath: string) =>
    originalLink(
      normalizeVirtualPath(fs, existingPath),
      assertWritablePath(fs, newPath, "link")
    );

  fs.utimes = (path: string, atime: Date, mtime: Date) =>
    originalUtimes(assertWritablePath(fs, path, "utimes"), atime, mtime);

  return fs;
}

/**
 * Filesystem instance type after Phoenix write guards have been applied.
 */
export type BashToolFilesystemPolicy = ReturnType<
  typeof applyBashToolFilesystemPolicy
>;
