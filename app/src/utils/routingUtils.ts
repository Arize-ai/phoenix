export const RETURN_URL_URL_PARAM = "returnUrl";

/**
 * Gets the current url path and query string, excluding the domain and protocol.
 */
const getCurrentUrlPath = (): string => {
  return window.location.pathname + window.location.search;
};

/**
 * Creates a return url query parameter based on the current pathname and search
 * @returns {string} returnUrlQueryParam - the return url query parameter
 */
export const createReturnUrlQueryParam = (): string => {
  return `${RETURN_URL_URL_PARAM}=${encodeURIComponent(getCurrentUrlPath())}`;
};

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
