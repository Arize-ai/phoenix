import { formatApiError, HttpError } from "@arizeai/phoenix-client";

const MAX_DETAIL_LENGTH = 500;

/**
 * Describe a failure for the terminal, including the server's explanation.
 *
 * The client throws `HttpError` with only the status line; the useful part of
 * a 409 (which bindings conflict) or a 422 (what was invalid) is in the body.
 */
export async function describeError(error: unknown): Promise<string> {
  if (error instanceof HttpError) {
    const detail = await readDetail(error);
    return `HTTP ${error.status} ${error.statusText}${detail ? `: ${detail}` : ""}`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function readDetail(error: HttpError): Promise<string> {
  let text: string;
  try {
    text = await error.response.clone().text();
  } catch {
    return "";
  }
  let detail = text.trim();
  if (
    error.response.headers.get("content-type")?.includes("application/json")
  ) {
    try {
      detail = formatApiError(JSON.parse(text));
    } catch {
      // Not JSON after all: keep the raw text.
    }
  }
  return detail.length > MAX_DETAIL_LENGTH
    ? `${detail.slice(0, MAX_DETAIL_LENGTH)}…`
    : detail;
}
