/**
 * Phoenix Insight observability configuration
 */

import { register, type NodeTracerProvider } from "@arizeai/phoenix-otel";
import { DiagLogLevel } from "@opentelemetry/api";

/**
 * Options for configuring observability
 */
export interface ObservabilityOptions {
  /** Whether to enable tracing */
  enabled: boolean;
  /** Phoenix base URL for sending traces */
  baseUrl?: string;
  /** Phoenix API key for authentication */
  apiKey?: string;
  /** Phoenix project name for organizing traces */
  projectName?: string;
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Global tracer provider instance
 */
let tracerProvider: NodeTracerProvider | null = null;

/**
 * Check if observability is enabled
 */
export function isObservabilityEnabled(): boolean {
  return tracerProvider !== null;
}

/**
 * Initialize observability for the Phoenix Insight agent
 */
export function initializeObservability(options: ObservabilityOptions): void {
  if (!options.enabled) {
    return;
  }

  // If already initialized, skip
  if (tracerProvider) {
    return;
  }

  try {
    // Configure the tracer provider
    tracerProvider = register({
      projectName: options.projectName || "phoenix-insight",
      url: options.baseUrl,
      apiKey: options.apiKey,
      batch: true,
      global: true,
      diagLogLevel: options.debug ? DiagLogLevel.DEBUG : undefined,
    });

    if (options.debug) {
      console.error(
        "🔭 Observability enabled - traces will be sent to Phoenix"
      );
    }
  } catch (error) {
    console.error("⚠️  Failed to initialize observability:", error);
    // Don't throw - observability should not break the main functionality
  }
}

/**
 * Shutdown observability and cleanup resources
 */
export async function shutdownObservability(): Promise<void> {
  if (tracerProvider) {
    try {
      await tracerProvider.shutdown();
      tracerProvider = null;
    } catch (error) {
      console.error("⚠️  Error shutting down observability:", error);
    }
  }
}

/**
 * Get the current tracer provider
 */
export function getTracerProvider(): NodeTracerProvider | null {
  return tracerProvider;
}
