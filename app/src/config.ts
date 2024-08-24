function getSanitizedPath(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export const BASE_URL = `${window.location.protocol}//${window.location.host}${getSanitizedPath(window.Config.basename)}`;
export const VERSION = window.Config.platformVersion;

export const HOSTED_PHOENIX_URL = "https://app.phoenix.arize.com";
const LLAMATRACE_URL = "https://llamatrace.com";

export const IS_HOSTED =
  BASE_URL === HOSTED_PHOENIX_URL || BASE_URL === LLAMATRACE_URL;
