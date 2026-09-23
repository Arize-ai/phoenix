function getSanitizedPath(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

const sanitizedPath = getSanitizedPath(window.Config.basename);
const isSecure = window.location.protocol === "https:";

export const BASE_URL = `${window.location.protocol}//${window.location.host}${sanitizedPath}`;
export const WS_BASE_URL = `${isSecure ? "wss" : "ws"}://${window.location.host}${sanitizedPath}`;
export const VERSION = window.Config.platformVersion;
