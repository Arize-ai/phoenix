import { useEffect, useState } from "react";

const PYPI_PACKAGE_URL = "https://pypi.org/pypi/arize-phoenix/json";

/**
 * Fetches the latest published arize-phoenix version once per session and
 * shares the result across all callers, so multiple components mounted at
 * once (e.g. the side nav and the settings page) don't each issue their own
 * request.
 */
let latestVersionPromise: Promise<string | null> | null = null;

function fetchLatestVersion(): Promise<string | null> {
  if (latestVersionPromise == null) {
    latestVersionPromise = fetch(PYPI_PACKAGE_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const version: unknown = data?.info?.version;
        return typeof version === "string" ? version : null;
      })
      .catch(() => null)
      .then((version) => {
        // Don't memoize a failed/empty result — let the next mount retry
        // instead of silently suppressing the notice for the rest of the
        // session after a transient network failure.
        if (version == null) {
          latestVersionPromise = null;
        }
        return version;
      });
  }
  return latestVersionPromise;
}

/**
 * Fetches the latest published version of arize-phoenix from PyPI.
 * @returns the latest version string, or null while loading or when the fetch fails
 */
export function useLatestPhoenixVersion(): string | null {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchLatestVersion().then((version) => {
      if (isMounted) {
        setLatestVersion(version);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return latestVersion;
}
