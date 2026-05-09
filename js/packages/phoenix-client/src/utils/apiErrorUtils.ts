export function formatApiError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const errorWithDetail = error as { detail?: unknown };
    if (typeof errorWithDetail.detail === "string") {
      return errorWithDetail.detail;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}
