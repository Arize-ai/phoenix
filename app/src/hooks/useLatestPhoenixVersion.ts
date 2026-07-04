import { useEffect, useState } from "react";

const PYPI_PACKAGE_URL = "https://pypi.org/pypi/arize-phoenix/json";
const SIMULATED_DEV_LATEST_VERSION = "99.0.0";

/**
 * Fetches the latest published version of arize-phoenix from PyPI.
 * @returns the latest version string, or null while loading or when the fetch fails
 */
export function useLatestPhoenixVersion(): string | null {
  const [latestVersion, setLatestVersion] = useState<string | null>(
    import.meta.env.DEV ? SIMULATED_DEV_LATEST_VERSION : null
  );

  useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }
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
