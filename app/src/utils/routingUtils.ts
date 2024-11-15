export const RETURN_URL_URL_PARAM = "returnUrl";

/**
 * Creates a URL to redirect to the login page with the current path as the return URL
 */
export function createLoginRedirectUrl() {
  const path = window.location.pathname;
  const basename = window.Config.basename;
  const searchParams = window.location.search;
  let basePath = "";
  let pathAfterBase = "";
  if (basename == null || basename === "" || basename === "/") {
    pathAfterBase = path;
  } else if (basename.startsWith("/") && path.startsWith(basename)) {
    const afterBase = path.slice(basename.length);
    if (afterBase === "" || afterBase.startsWith("/")) {
      basePath = basename;
      pathAfterBase = afterBase;
    }
  }
  let redirectUrl = `${basePath}/login`;
  if (pathAfterBase.length || searchParams.length) {
    redirectUrl += `?${RETURN_URL_URL_PARAM}=${encodeURIComponent(pathAfterBase + searchParams)}`;
  }
  return redirectUrl;
}

/**
 * If a basename is set, prepends the basename to the provided path
 */
export function prependBaseNameIfExists(path: string) {
  const basename = window.Config.basename;
  if (basename == null || basename === "" || basename === "/") {
    return path;
  }
  return basename + path;
}

/**
 * Takes a path and the current search params and creates a redirect url with the return url query parameter
 *
 */
export const createRedirectUrlWithReturn = ({
  path,
  searchParams,
}: {
  path: string;
  searchParams?: Record<string, string>;
}) => {
  const url = new URL(window.location.href);
  const returnUrl = url.searchParams.get(RETURN_URL_URL_PARAM);

  const params = new URLSearchParams(searchParams || {});
  if (returnUrl) {
    params.set(RETURN_URL_URL_PARAM, returnUrl);
  }
  const paramsString = params.toString();
  return `${path}${paramsString ? `?${paramsString}` : ""}`;
};

/**
 * Security check for redirect urls
 * @param {unknown} url - the potential redirect
 * @returns {boolean} isValid - whether or not the provided value is valid
 */
const isValidRedirectUrl = (url: unknown): url is string => {
  const isNonInternalRedirect =
    typeof url != "string" ||
    !url.startsWith("/") ||
    url.replace(/\\/g, "/").startsWith("//");
  return !isNonInternalRedirect;
};

/**
 * Function that  makes the url sanitized (e.g. removes malicious urls)
 * @param {unknown} unsanitizedURL - the potential redirect
 * @returns {string} url - a valid path into the app
 */
export const sanitizeUrl = (unsanitizedURL: unknown): string => {
  return isValidRedirectUrl(unsanitizedURL) ? unsanitizedURL : "/";
};

/**
 * Gets the return URL from the query string.
 */
export const getReturnUrl = (): string => {
  const url = new URL(window.location.href);
  return sanitizeUrl(url.searchParams.get(RETURN_URL_URL_PARAM));
};
