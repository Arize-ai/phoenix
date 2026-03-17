import type {
  BufferEncoding,
  CpOptions,
  FileContent,
  IFileSystem,
  MkdirOptions,
  RmOptions,
} from "just-bash";

type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];

export const BASH_TOOL_READONLY_ROOT = "/phoenix";
export const BASH_TOOL_WORKSPACE_ROOT = "/home/user/workspace";

function normalizeVirtualPath(fs: IFileSystem, path: string) {
  return fs.resolvePath("/", path);
}

function isWithinRoot(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`);
}

function assertWritablePath(fs: IFileSystem, path: string, operation: string) {
  const normalizedPath = normalizeVirtualPath(fs, path);

  if (isWithinRoot(normalizedPath, BASH_TOOL_WORKSPACE_ROOT)) {
    return normalizedPath;
  }

  if (isWithinRoot(normalizedPath, BASH_TOOL_READONLY_ROOT)) {
    throw new Error(
      `${operation} is not allowed in ${BASH_TOOL_READONLY_ROOT}. ` +
        `Phoenix context files are read-only; copy them into ${BASH_TOOL_WORKSPACE_ROOT} first.`
    );
  }

  throw new Error(
    `${operation} is only allowed in ${BASH_TOOL_WORKSPACE_ROOT}. ` +
      `Writes outside the workspace are blocked.`
  );
}

export function applyBashToolFilesystemPolicy(fs: IFileSystem) {
  /**
   * Wrap filesystem mutation methods with a Phoenix-specific path policy.
   * Writes are allowed under `/home/user/workspace`, denied under `/phoenix`,
   * and rejected everywhere else with a clear error.
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
  ) =>
    originalWriteFile(
      assertWritablePath(fs, path, "writeFile"),
      content,
      options
    );

  fs.appendFile = (
    path: string,
    content: FileContent,
    options?: WriteFileOptions | BufferEncoding
  ) =>
    originalAppendFile(
      assertWritablePath(fs, path, "appendFile"),
      content,
      options
    );

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

export type BashToolFilesystemPolicy = ReturnType<
  typeof applyBashToolFilesystemPolicy
>;
