export const RETURN_URL_URL_PARAM = "returnUrl";

/**
 * Creates a URL to redirect to the login page with the current path as the return URL
 */
export function createLoginRedirectUrl() {
  const basename = window.Config.basename;
  const isEmptyBasename =
    basename == null || basename === "" || basename === "/";
  const isValidNonEmptyBasename =
    basename.startsWith("/") && !basename.endsWith("/");
  if (!(isEmptyBasename || isValidNonEmptyBasename)) {
    throw new Error(`Invalid basename: ${basename}`);
  }
  const pathname = window.location.pathname;
  const origin = window.location.origin;
  const existingSearchParams = new URLSearchParams(window.location.search);
  if (isEmptyBasename) {
    const returnUrl = new URL(pathname, origin);
    existingSearchParams.forEach((value, key) => {
      returnUrl.searchParams.append(key, value);
    });
    const redirectUrl = new URL("/login", origin);
    redirectUrl.searchParams.set(
      RETURN_URL_URL_PARAM,
      returnUrl.pathname + returnUrl.search
    );
    return redirectUrl.pathname + redirectUrl.search;
  }
  if (pathname.startsWith(basename)) {
    const pathnameAfterBasename = pathname.slice(basename.length);
    const basenameMatchesPathname =
      pathnameAfterBasename === "" || pathnameAfterBasename.startsWith("/");
    if (basenameMatchesPathname) {
      const returnUrl = new URL(pathnameAfterBasename, origin);
      existingSearchParams.forEach((value, key) => {
        returnUrl.searchParams.append(key, value);
      });
      const redirectUrl = new URL(basename + "/login", origin);
      redirectUrl.searchParams.set(
        RETURN_URL_URL_PARAM,
        returnUrl.pathname + returnUrl.search
      );
      return redirectUrl.pathname + redirectUrl.search;
    }
  }
  return basename + "/login";
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
