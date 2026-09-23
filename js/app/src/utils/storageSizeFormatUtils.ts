/**
 * Format bytes as human-readable text.
 */
export function storageSizeFormatter(
  bytes: number,
  config?: {
    /**
     * Set to true for metric (SI) units, aka powers of 1000. False to use binary (IEC), aka powers of 1024.
     * @default false
     */
    si?: boolean;
    /**
     * The number of decimal places
     * @default 1
     */
    decimalPlaces?: number;
  }
) {
  const { si = false, decimalPlaces = 1 } = config ?? {};
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10 ** decimalPlaces;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(decimalPlaces) + " " + units[u];
}
