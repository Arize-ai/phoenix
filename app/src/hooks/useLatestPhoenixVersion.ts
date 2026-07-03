import { useEffect, useState } from "react";

const PYPI_PACKAGE_URL = "https://pypi.org/pypi/arize-phoenix/json";

/**
 * Fetches the latest published version of arize-phoenix from PyPI.
 * @returns the latest version string, or null while loading or when the fetch fails
 */
export function useLatestPhoenixVersion(): string | null {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(PYPI_PACKAGE_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const version: unknown = data?.info?.version;
        if (typeof version === "string") {
          setLatestVersion(version);
        }
      })
      .catch(() => {
        // If PyPI is unreachable, stay silent — no version notice is shown
      });
    return () => controller.abort();
  }, []);

  return latestVersion;
}
