import { type componentsV1, HttpError } from "@arizeai/phoenix-client";
import { assertUnreachable } from "@arizeai/phoenix-client/utils/assertUnreachable";

import { createPhoenixClient } from "../client";
import type { PhoenixConfig } from "../config";
import { AuthRequiredError, ExitCode } from "../exitCodes";

export type ViewerUser =
  componentsV1["schemas"]["GetViewerResponseBody"]["data"];

interface FetchViewerSuccess {
  status: "success";
  user: ViewerUser;
}

interface FetchViewerError {
  status: "network_error" | "auth_error" | "not_found" | "unknown_error";
  message: string;
}

export type FetchViewerResult = FetchViewerSuccess | FetchViewerError;

interface FetchViewerOptions {
  /**
   * Resolved CLI config whose credentials identify the viewer.
   */
  config: PhoenixConfig;
  /**
   * Aborts the request; a timeout signal's abort is reported as a network
   * error.
   */
  signal?: AbortSignal;
}

/**
 * Fetch the authenticated viewer from the Phoenix server.
 * Gracefully handles network errors, auth failures, and missing endpoints.
 */
export async function fetchViewer({
  config,
  signal,
}: FetchViewerOptions): Promise<FetchViewerResult> {
  try {
    const client = createPhoenixClient({ config });
    const response = await client.GET("/v1/user", { signal });
    return { status: "success", user: response.data!.data };
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      return { status: "network_error", message: error.message };
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { status: "network_error", message: error.message };
    }
    if (error instanceof AuthRequiredError) {
      return { status: "auth_error", message: error.message };
    }
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) {
        return { status: "auth_error", message: error.message };
      }
      if (error.status === 404) {
        return { status: "not_found", message: error.message };
      }
    }
    if (error instanceof Error) {
      return { status: "unknown_error", message: error.message };
    }
    return { status: "unknown_error", message: String(error) };
  }
}

/**
 * Fetch the viewer to report auth status, accounting for deployments that
 * changed from OAuth authentication to anonymous access. An expired profile
 * token can fail during refresh before `/v1/user` is requested, so retry
 * without credentials and accept the result only when the server explicitly
 * reports anonymous access.
 */
export async function fetchViewerForStatus({
  config,
  signal,
}: FetchViewerOptions): Promise<FetchViewerResult> {
  const viewerResult = await fetchViewer({ config, signal });
  const canCheckAnonymousAccess =
    config.credentialSource === "oauth" &&
    (viewerResult.status === "auth_error" ||
      viewerResult.status === "unknown_error");
  if (!canCheckAnonymousAccess) {
    return viewerResult;
  }

  const anonymousResult = await fetchViewer({
    config: { endpoint: config.endpoint, headers: config.headers },
    signal,
  });
  const isAnonymous =
    anonymousResult.status === "success" &&
    anonymousResult.user.auth_method === "ANONYMOUS";
  return isAnonymous ? anonymousResult : viewerResult;
}

export function getExitCodeForViewerResult(
  result: FetchViewerResult
): ExitCode {
  switch (result.status) {
    case "success":
    // 404 means the server is an older version without /v1/user — the token
    // may still be valid, we just can't verify it. Not a failure.
    case "not_found":
      return ExitCode.SUCCESS;
    case "auth_error":
      return ExitCode.AUTH_REQUIRED;
    case "network_error":
      return ExitCode.NETWORK_ERROR;
    case "unknown_error":
      return ExitCode.FAILURE;
    default:
      return assertUnreachable(result);
  }
}
