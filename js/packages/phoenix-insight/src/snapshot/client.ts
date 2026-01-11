import { createClient, type PhoenixClient } from "@arizeai/phoenix-client";

export class PhoenixClientError extends Error {
  public code:
    | "NETWORK_ERROR"
    | "AUTH_ERROR"
    | "INVALID_RESPONSE"
    | "UNKNOWN_ERROR";
  public originalError?: unknown;

  constructor(
    message: string,
    code: "NETWORK_ERROR" | "AUTH_ERROR" | "INVALID_RESPONSE" | "UNKNOWN_ERROR",
    originalError?: unknown
  ) {
    super(message);
    this.name = "PhoenixClientError";
    this.code = code;
    this.originalError = originalError;
  }
}

export interface PhoenixClientConfig {
  baseURL?: string;
  apiKey?: string;
}

/**
 * Creates a wrapped Phoenix client with error handling
 */
export function createPhoenixClient(
  config: PhoenixClientConfig = {}
): PhoenixClient {
  const headers: Record<string, string> = {};

  if (config.apiKey) {
    headers["api_key"] = config.apiKey;
  }

  const clientOptions: Parameters<typeof createClient>[0] = {
    options: {
      baseUrl: config.baseURL,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    },
  };

  return createClient(clientOptions);
}

/**
 * Wraps an async operation with standardized error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new PhoenixClientError(
        `Network error during ${context}: Unable to connect to Phoenix server`,
        "NETWORK_ERROR",
        error
      );
    }

    // HTTP errors from the middleware
    if (error instanceof Error && error.message.includes(": ")) {
      const parts = error.message.split(": ", 2);
      if (parts.length === 2 && parts[1]) {
        const [url, statusInfo] = parts;
        const statusParts = statusInfo.split(" ");
        const statusCode = statusParts[0];
        const statusText = statusParts.slice(1).join(" ");

        if (statusCode === "401" || statusCode === "403") {
          throw new PhoenixClientError(
            `Authentication error during ${context}: ${statusText}`,
            "AUTH_ERROR",
            error
          );
        }

        if (statusCode && statusCode.startsWith("4")) {
          throw new PhoenixClientError(
            `Client error during ${context}: ${statusCode} ${statusText}`,
            "INVALID_RESPONSE",
            error
          );
        }

        if (statusCode && statusCode.startsWith("5")) {
          throw new PhoenixClientError(
            `Server error during ${context}: ${statusCode} ${statusText}`,
            "NETWORK_ERROR",
            error
          );
        }
      }
    }

    // Unknown errors
    throw new PhoenixClientError(
      `Unexpected error during ${context}: ${error instanceof Error ? error.message : String(error)}`,
      "UNKNOWN_ERROR",
      error
    );
  }
}

/**
 * Helper to safely extract data from API responses
 */
export function extractData<T>(response: { data?: T; error?: unknown }): T {
  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    throw new PhoenixClientError(
      "Invalid API response: missing data",
      "INVALID_RESPONSE"
    );
  }

  return response.data;
}
