function getSanitizedPath(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}
export const BASE_URL = `${window.location.protocol}//${window.location.host}${getSanitizedPath(window.Config.basename)}`;
export const VERSION = window.Config.platformVersion;
export const IS_HOSTED =
  true || BASE_URL.includes("llamatrace.com") || BASE_URL.includes("arize.com");
