import type { Request, Response, RequestHandler } from "express";
import type { Provider, HandlerConfig } from "../providers/types.js";
import { registry } from "../registry.js";
import { metrics, generateRequestId } from "../metrics.js";
import { detailedMetrics } from "../detailed-metrics.js";

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a unified request handler for a provider
 *
 * This middleware handles:
 * 1. Endpoint enabled check
 * 2. Rate limiting with per-endpoint state
 * 3. Error/failure injection
 * 4. Request validation
 * 5. Metrics collection (basic and detailed)
 * 6. Routing to provider handler
 */
export function createEndpointHandler(provider: Provider): RequestHandler {
  return async (req: Request, res: Response) => {
    const requestId = generateRequestId();
    const endpointConfig = registry.getEndpointConfig(provider.id);

    // 1. Check if endpoint is enabled
    if (!endpointConfig.enabled) {
      res.status(503).json(provider.formatDisabledError());
      return;
    }

    // 2. Check rate limit
    const rateLimiter = registry.getRateLimiter(provider.id);
    const rateLimitResult = rateLimiter.check();

    // Always set rate limit headers
    for (const [key, value] of Object.entries(rateLimitResult.headers)) {
      res.setHeader(key, value);
    }

    if (!rateLimitResult.allowed) {
      metrics.rateLimited(provider.id);
      detailedMetrics.rateLimited(provider.id);
      res.status(429).json(provider.formatRateLimitError(rateLimitResult.retryAfter || 60));
      return;
    }

    // 3. Failure injection (enhanced)
    const failureResult = await handleFailureInjection(provider.id, requestId, res, provider);
    if (failureResult.handled) {
      return;
    }

    // 4. Validate request
    const validation = provider.validateRequest(req);
    if (!validation.valid) {
      res.status(400).json(provider.formatValidationError(validation.message!, validation.field));
      return;
    }

    // 5. Determine if streaming
    const isStreaming = provider.isStreamingRequest(req);

    // 6. Track metrics (both systems) - only if not already started by failure injection
    if (!failureResult.metricsStarted) {
      metrics.requestStart(provider.id, requestId, isStreaming);
      detailedMetrics.requestStart(provider.id, requestId);
    }

    // 7. Build handler config with load-based latency adjustment
    const loadFactor = registry.getLoadFactor(provider.id);
    const handlerConfig: HandlerConfig = {
      streamInitialDelayMs: Math.round(endpointConfig.streamInitialDelayMs * loadFactor),
      streamDelayMs: Math.round(endpointConfig.streamDelayMs * loadFactor),
      streamJitterMs: endpointConfig.streamJitterMs,
      streamChunkSize: endpointConfig.streamChunkSize,
      toolCallProbability: endpointConfig.toolCallProbability,
      getDefaultResponse: registry.getGlobalConfig().getDefaultResponse,
    };

    // 8. Handle request
    try {
      if (isStreaming) {
        // Check for streaming interruption
        const shouldInterrupt = registry.shouldInterruptStream(provider.id);
        if (shouldInterrupt) {
          await handleStreamingWithInterruption(req, res, provider, handlerConfig, requestId);
        } else {
          await provider.handleStreaming(req, res, handlerConfig);
        }
      } else {
        const response = provider.handleNonStreaming(req, handlerConfig);
        res.json(response);
      }
      metrics.requestEnd(requestId);
      detailedMetrics.requestEnd(requestId);
    } catch (error) {
      // If stream was interrupted, metrics already recorded - don't duplicate
      if (error instanceof StreamInterruptedError) {
        return;
      }

      console.error(`Error handling ${provider.id} request:`, error);
      metrics.requestError(requestId, String(error));
      detailedMetrics.requestError(requestId, "handler_error");

      // Only send error if headers not already sent (streaming may have started)
      if (!res.headersSent) {
        res.status(500).json(provider.formatServerError());
      }
    }
  };
}

/**
 * Handle failure injection with enhanced modes
 * Returns whether injection was triggered and if the request was fully handled
 */
async function handleFailureInjection(
  endpointId: string,
  requestId: string,
  res: Response,
  provider: Provider
): Promise<{ handled: boolean; metricsStarted: boolean }> {
  const config = registry.getEndpointConfig(endpointId as Parameters<typeof registry.getEndpointConfig>[0]);
  
  if (config.errorRate <= 0 || Math.random() >= config.errorRate) {
    return { handled: false, metricsStarted: false };
  }

  const errorTypes = config.errorTypes.length > 0 ? config.errorTypes : ["server_error"];
  const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];

  // Start tracking for injected failures
  metrics.requestStart(endpointId as Parameters<typeof metrics.requestStart>[0], requestId, false);
  detailedMetrics.requestStart(endpointId as Parameters<typeof detailedMetrics.requestStart>[0], requestId);

  switch (errorType) {
    case "timeout":
      // Just hang - client will timeout
      metrics.requestError(requestId, "timeout_injected");
      detailedMetrics.requestError(requestId, "timeout_injected");
      return { handled: true, metricsStarted: true };

    case "server_error":
      metrics.requestError(requestId, "server_error_injected");
      detailedMetrics.requestError(requestId, "server_error_injected");
      res.status(500).json(provider.formatServerError("Internal server error (injected)"));
      return { handled: true, metricsStarted: true };

    case "bad_request":
      metrics.requestError(requestId, "bad_request_injected");
      detailedMetrics.requestError(requestId, "bad_request_injected");
      res.status(400).json(provider.formatValidationError("Bad request (injected)"));
      return { handled: true, metricsStarted: true };

    case "slow_response":
      // Add significant delay before responding normally
      // Metrics already started, will be completed by normal flow
      await sleep(5000 + Math.random() * 5000); // 5-10 seconds
      return { handled: false, metricsStarted: true };

    case "connection_reset":
      // Destroy the connection abruptly
      metrics.requestError(requestId, "connection_reset_injected");
      detailedMetrics.requestError(requestId, "connection_reset_injected");
      res.socket?.destroy();
      return { handled: true, metricsStarted: true };

    default:
      // Unknown error type - end the metrics tracking we started
      metrics.requestEnd(requestId);
      detailedMetrics.requestEnd(requestId);
      return { handled: false, metricsStarted: false };
  }
}

/**
 * Custom error to signal stream was interrupted (metrics already recorded)
 */
class StreamInterruptedError extends Error {
  constructor() {
    super("Stream interrupted");
    this.name = "StreamInterruptedError";
  }
}

/**
 * Handle streaming with potential mid-stream interruption
 */
async function handleStreamingWithInterruption(
  req: Request,
  res: Response,
  provider: Provider,
  handlerConfig: HandlerConfig,
  requestId: string
): Promise<void> {
  // Start streaming normally
  const originalEnd = res.end.bind(res);
  let chunkCount = 0;
  let interrupted = false;
  const interruptAfter = 3 + Math.floor(Math.random() * 5); // Interrupt after 3-8 chunks

  // Override res.write to count chunks and potentially interrupt
  const originalWrite = res.write.bind(res) as typeof res.write;
  res.write = function (
    chunk: unknown,
    encodingOrCallback?: BufferEncoding | ((error: Error | null | undefined) => void),
    callback?: (error: Error | null | undefined) => void
  ): boolean {
    chunkCount++;
    if (chunkCount >= interruptAfter && !interrupted) {
      // Interrupt the stream - record metrics once
      interrupted = true;
      metrics.requestError(requestId, "stream_interrupted");
      detailedMetrics.requestError(requestId, "stream_interrupted");
      res.socket?.destroy();
      return false;
    }
    if (typeof encodingOrCallback === "function") {
      return originalWrite(chunk, encodingOrCallback);
    }
    if (encodingOrCallback !== undefined) {
      return originalWrite(chunk, encodingOrCallback, callback);
    }
    return originalWrite(chunk);
  } as typeof res.write;

  res.end = originalEnd;

  try {
    await provider.handleStreaming(req, res, handlerConfig);
  } catch {
    // If we interrupted, the error is expected - don't re-throw
    if (interrupted) {
      throw new StreamInterruptedError();
    }
    throw new Error("Streaming handler failed");
  }

  // If we interrupted but no error was thrown, signal it
  if (interrupted) {
    throw new StreamInterruptedError();
  }
}

/**
 * Create all middleware for a provider (can be extended with additional middleware)
 */
export function createProviderMiddleware(provider: Provider): RequestHandler[] {
  return [createEndpointHandler(provider)];
}
