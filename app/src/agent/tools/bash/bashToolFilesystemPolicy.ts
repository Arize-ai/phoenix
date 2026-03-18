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
 * The writable filesystem entrypoints that must be wrapped by the bash policy.
 */
export const BASH_TOOL_FILESYSTEM_MUTATION_METHOD_NAMES = [
  "appendFile",
  "chmod",
  "cp",
  "link",
  "mkdir",
  "mv",
  "rm",
  "symlink",
  "utimes",
  "writeFile",
] as const;

export type BashToolFilesystemMutationMethod =
  (typeof BASH_TOOL_FILESYSTEM_MUTATION_METHOD_NAMES)[number];

export type BashToolFilesystemMutationMethods = Pick<
  IFileSystem,
  BashToolFilesystemMutationMethod
>;

/**
 * Virtual root containing generated Phoenix context files for the current page.
 */
export const BASH_TOOL_READONLY_ROOT = "/phoenix";
/**
 * Virtual scratch space where the model is allowed to mutate files.
 */
export const BASH_TOOL_WORKSPACE_ROOT = "/home/user/workspace";

/**
 * Captures the current writable filesystem methods so internal setup code can
 * temporarily bypass policy wrappers and then restore them.
 */
export function captureBashToolFilesystemMutationMethods(
  fs: BashToolFilesystemMutationMethods
): BashToolFilesystemMutationMethods {
  return Object.fromEntries(
    BASH_TOOL_FILESYSTEM_MUTATION_METHOD_NAMES.map((methodName) => [
      methodName,
      fs[methodName].bind(fs),
    ])
  ) as BashToolFilesystemMutationMethods;
}

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

/**
 * Enforces the Phoenix bash sandbox write policy on a just-bash filesystem.
 */
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

/**
 * Filesystem instance type after Phoenix write guards have been applied.
 */
export type BashToolFilesystemPolicy = ReturnType<
  typeof applyBashToolFilesystemPolicy
>;
