export const RETURN_URL_URL_PARAM = "returnUrl";

/**
 * Gets the current url path and query string, excluding the domain and protocol.
 */
const getCurrentUrlPath = (): string => {
  return window.location.pathname + window.location.search;
};

export const getReturnUrlQueryParam = (): string => {
  return `${RETURN_URL_URL_PARAM}=${encodeURIComponent(getCurrentUrlPath())}`;
};

/**
 * Security check for redirect urls
 * @param {unknown} url - the potential redirect
 * @returns {boolean} isValid - whether or not the provided value is valid
 */
function isValidRedirectUrl(url: unknown): url is string {
  const isNonInternalRedirect =
    typeof url != "string" ||
    !url.startsWith("/") ||
    url.replace(/\\/g, "/").startsWith("//");
  return !isNonInternalRedirect;
}

/**
 * Function that  makes the url sanitized (e.g. removes malicious urls)
 * @param {unknown} unsanitizedURL - the potential redirect
 * @returns {string} url - a valid path into the app
 */
export function sanitizeUrl(unsanitizedURL: unknown): string {
  return isValidRedirectUrl(unsanitizedURL) ? unsanitizedURL : "/";
}

/**
 * Gets the return URL from the query string.
 */
export const getReturnUrl = (): string => {
  const url = new URL(window.location.href);
  return sanitizeUrl(url.searchParams.get(RETURN_URL_URL_PARAM));
};
